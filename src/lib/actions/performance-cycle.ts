"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";

export type PerformanceCycleState = { error?: string };

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  selfReviewDueDate: z.string().optional().or(z.literal("")),
  managerReviewDueDate: z.string().optional().or(z.literal("")),
});

export async function createPerformanceCycle(
  _prevState: PerformanceCycleState,
  formData: FormData
): Promise<PerformanceCycleState> {
  try {
    await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    selfReviewDueDate: formData.get("selfReviewDueDate") ?? undefined,
    managerReviewDueDate: formData.get("managerReviewDueDate") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate < startDate) {
    return { error: "End date can't be before the start date." };
  }

  try {
    const existing = await prisma.performanceCycle.findUnique({
      where: { name: parsed.data.name },
    });
    if (existing) {
      return { error: "A cycle with that name already exists." };
    }
    await prisma.performanceCycle.create({
      data: {
        name: parsed.data.name,
        startDate,
        endDate,
        selfReviewDueDate: parsed.data.selfReviewDueDate
          ? new Date(parsed.data.selfReviewDueDate)
          : undefined,
        managerReviewDueDate: parsed.data.managerReviewDueDate
          ? new Date(parsed.data.managerReviewDueDate)
          : undefined,
      },
    });
  } catch (err) {
    console.error("createPerformanceCycle failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/performance");
  return {};
}

const statusSchema = z.object({
  cycleId: z.string().min(1),
  status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]),
});

/**
 * No enforced ordering (DRAFT -> ACTIVE -> CLOSED) — HR can move a cycle to
 * any status, same permissive pattern as LeaveType.isActive. Goals/reviews
 * for a cycle are only creatable/editable while it's ACTIVE (enforced in
 * goal.ts / performance-review.ts), so closing one simply freezes it.
 */
export async function updatePerformanceCycleStatus(
  _prevState: PerformanceCycleState,
  formData: FormData
): Promise<PerformanceCycleState> {
  try {
    await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = statusSchema.safeParse({
    cycleId: formData.get("cycleId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    await prisma.performanceCycle.update({
      where: { id: parsed.data.cycleId },
      data: { status: parsed.data.status },
    });
  } catch (err) {
    console.error("updatePerformanceCycleStatus failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/performance");
  return {};
}
