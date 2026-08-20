"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";

export type GoalActionState = { error?: string };

/**
 * Who may add/edit/delete a goal's *definition* (title/description/weight)
 * for a given employee: the employee themselves, their reporting manager,
 * or HR. Goal *progress* (status) is employee-only — see updateGoalStatus.
 */
async function canManageGoalsFor(sessionUserId: string, role: string, employeeId: string) {
  if (HR_WRITE_ROLES.includes(role as (typeof HR_WRITE_ROLES)[number])) {
    return true;
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) return false;
  if (employee.userId === sessionUserId) return true;
  if (role === "MANAGER" && employee.reportingManagerId) {
    const managerEmployee = await prisma.employee.findUnique({
      where: { userId: sessionUserId },
    });
    return !!managerEmployee && employee.reportingManagerId === managerEmployee.id;
  }
  return false;
}

const addSchema = z.object({
  employeeId: z.string().min(1),
  cycleId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional().or(z.literal("")),
  weight: z.coerce.number().min(0).max(100).optional(),
});

export async function addGoal(
  _prevState: GoalActionState,
  formData: FormData
): Promise<GoalActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = addSchema.safeParse({
    employeeId: formData.get("employeeId"),
    cycleId: formData.get("cycleId"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    weight: formData.get("weight") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { employeeId, cycleId, title, description, weight } = parsed.data;

  try {
    const allowed = await canManageGoalsFor(session.user.id, session.user.role, employeeId);
    if (!allowed) {
      return { error: "You do not have permission to set goals for this employee." };
    }

    const cycle = await prisma.performanceCycle.findUnique({ where: { id: cycleId } });
    if (!cycle || cycle.status !== "ACTIVE") {
      return { error: "Goals can only be added to an active cycle." };
    }

    const review = await prisma.performanceReview.findUnique({
      where: { employeeId_cycleId: { employeeId, cycleId } },
    });
    if (review && review.status !== "NOT_STARTED") {
      return { error: "Goals can't be changed after the self-review has started." };
    }

    await prisma.goal.create({
      data: {
        employeeId,
        cycleId,
        title,
        description: description || undefined,
        weight: weight ?? 0,
      },
    });
  } catch (err) {
    console.error("addGoal failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/performance");
  return {};
}

const deleteSchema = z.object({ goalId: z.string().min(1) });

export async function deleteGoal(
  _prevState: GoalActionState,
  formData: FormData
): Promise<GoalActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = deleteSchema.safeParse({ goalId: formData.get("goalId") });
  if (!parsed.success) {
    return { error: "Invalid request." };
  }

  try {
    const goal = await prisma.goal.findUnique({ where: { id: parsed.data.goalId } });
    if (!goal) {
      return { error: "Goal not found." };
    }
    const allowed = await canManageGoalsFor(session.user.id, session.user.role, goal.employeeId);
    if (!allowed) {
      return { error: "You do not have permission to remove this goal." };
    }
    const review = await prisma.performanceReview.findUnique({
      where: { employeeId_cycleId: { employeeId: goal.employeeId, cycleId: goal.cycleId } },
    });
    if (review && review.status !== "NOT_STARTED") {
      return { error: "Goals can't be changed after the self-review has started." };
    }
    await prisma.goal.delete({ where: { id: goal.id } });
  } catch (err) {
    console.error("deleteGoal failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/performance");
  return {};
}

const statusSchema = z.object({
  goalId: z.string().min(1),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]),
});

/**
 * Progress tracking (not the rating) — employee-only, any time their goal's
 * cycle is still ACTIVE, independent of the self-review having started.
 */
export async function updateGoalStatus(
  _prevState: GoalActionState,
  formData: FormData
): Promise<GoalActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = statusSchema.safeParse({
    goalId: formData.get("goalId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const goal = await prisma.goal.findUnique({
      where: { id: parsed.data.goalId },
      include: { employee: true, cycle: true },
    });
    if (!goal) {
      return { error: "Goal not found." };
    }
    if (goal.employee.userId !== session.user.id) {
      return { error: "You can only update your own goals." };
    }
    if (goal.cycle.status !== "ACTIVE") {
      return { error: "This cycle is no longer active." };
    }
    await prisma.goal.update({
      where: { id: goal.id },
      data: { status: parsed.data.status },
    });
  } catch (err) {
    console.error("updateGoalStatus failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/performance");
  return {};
}
