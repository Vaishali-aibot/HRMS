"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";

export type PerformanceReviewState = { error?: string };

const ratingSchema = z.coerce.number().int().min(1).max(5);

const selfReviewSchema = z.object({
  cycleId: z.string().min(1),
  comments: z.string().optional().or(z.literal("")),
});

/**
 * The employee rates each of their own goals (1-5) and leaves overall
 * comments. Ratings arrive as `selfRating_<goalId>` fields — one per goal
 * in the cycle — since the goal list is dynamic. Every goal must be rated;
 * this can only be done once (locks the goal definitions via goal.ts's
 * NOT_STARTED-only check) and moves the review to SELF_REVIEW, handing it
 * to the manager.
 */
export async function submitSelfReview(
  _prevState: PerformanceReviewState,
  formData: FormData
): Promise<PerformanceReviewState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = selfReviewSchema.safeParse({
    cycleId: formData.get("cycleId"),
    comments: formData.get("comments") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { cycleId, comments } = parsed.data;

  try {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    if (!employee) {
      return { error: "Your account isn't linked to an employee record yet — contact HR." };
    }

    const cycle = await prisma.performanceCycle.findUnique({ where: { id: cycleId } });
    if (!cycle || cycle.status !== "ACTIVE") {
      return { error: "This cycle is not open for review." };
    }

    const existingReview = await prisma.performanceReview.findUnique({
      where: { employeeId_cycleId: { employeeId: employee.id, cycleId } },
    });
    if (existingReview && existingReview.status !== "NOT_STARTED") {
      return { error: "You've already submitted your self-review for this cycle." };
    }

    const goals = await prisma.goal.findMany({ where: { employeeId: employee.id, cycleId } });
    if (goals.length === 0) {
      return { error: "Add at least one goal before submitting your self-review." };
    }

    const ratings = new Map<string, number>();
    for (const goal of goals) {
      const parsedRating = ratingSchema.safeParse(formData.get(`selfRating_${goal.id}`));
      if (!parsedRating.success) {
        return { error: `Please rate "${goal.title}" from 1 to 5.` };
      }
      ratings.set(goal.id, parsedRating.data);
    }

    await prisma.$transaction(async (tx) => {
      for (const [goalId, rating] of ratings) {
        await tx.goal.update({ where: { id: goalId }, data: { selfRating: rating } });
      }
      await tx.performanceReview.upsert({
        where: { employeeId_cycleId: { employeeId: employee.id, cycleId } },
        update: {
          selfComments: comments || undefined,
          selfSubmittedAt: new Date(),
          status: "SELF_REVIEW",
        },
        create: {
          employeeId: employee.id,
          cycleId,
          selfComments: comments || undefined,
          selfSubmittedAt: new Date(),
          status: "SELF_REVIEW",
        },
      });
    });
  } catch (err) {
    console.error("submitSelfReview failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/performance");
  return {};
}

const managerReviewSchema = z.object({
  employeeId: z.string().min(1),
  cycleId: z.string().min(1),
  comments: z.string().optional().or(z.literal("")),
  overallRating: ratingSchema,
});

/**
 * The manager (or HR, as a backup — same isHR||isManager pattern as
 * decideLeaveRequest) rates each goal and gives an overall rating +
 * comments. Requires the employee's self-review to already be in, mirroring
 * a self-review-then-manager-review workflow.
 */
export async function submitManagerReview(
  _prevState: PerformanceReviewState,
  formData: FormData
): Promise<PerformanceReviewState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = managerReviewSchema.safeParse({
    employeeId: formData.get("employeeId"),
    cycleId: formData.get("cycleId"),
    comments: formData.get("comments") ?? undefined,
    overallRating: formData.get("overallRating"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { employeeId, cycleId, comments, overallRating } = parsed.data;

  try {
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) {
      return { error: "Employee not found." };
    }

    const isHR = HR_WRITE_ROLES.includes(session.user.role);
    let isManager = false;
    if (!isHR && session.user.role === "MANAGER") {
      const managerEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
      });
      isManager = !!managerEmployee && employee.reportingManagerId === managerEmployee.id;
    }
    if (!isHR && !isManager) {
      return { error: "You do not have permission to review this employee." };
    }

    const review = await prisma.performanceReview.findUnique({
      where: { employeeId_cycleId: { employeeId, cycleId } },
    });
    if (!review || review.status === "NOT_STARTED") {
      return { error: "This employee hasn't submitted their self-review yet." };
    }
    if (review.status === "COMPLETED") {
      return { error: "This review has already been completed." };
    }

    const goals = await prisma.goal.findMany({ where: { employeeId, cycleId } });
    const ratings = new Map<string, number>();
    for (const goal of goals) {
      const parsedRating = ratingSchema.safeParse(formData.get(`managerRating_${goal.id}`));
      if (!parsedRating.success) {
        return { error: `Please rate "${goal.title}" from 1 to 5.` };
      }
      ratings.set(goal.id, parsedRating.data);
    }

    await prisma.$transaction(async (tx) => {
      for (const [goalId, rating] of ratings) {
        await tx.goal.update({ where: { id: goalId }, data: { managerRating: rating } });
      }
      await tx.performanceReview.update({
        where: { id: review.id },
        data: {
          reviewerId: session.user.id,
          managerComments: comments || undefined,
          managerOverallRating: overallRating,
          managerSubmittedAt: new Date(),
          status: "COMPLETED",
        },
      });
    });
  } catch (err) {
    console.error("submitManagerReview failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/performance");
  return {};
}
