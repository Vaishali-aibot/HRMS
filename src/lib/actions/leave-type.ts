"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";

export type LeaveTypeState = { error?: string };

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  annualDays: z.coerce.number().nonnegative("Must be zero or more"),
  carryForwardLimit: z.coerce.number().nonnegative("Must be zero or more").optional(),
});

export async function createLeaveType(
  _prevState: LeaveTypeState,
  formData: FormData
): Promise<LeaveTypeState> {
  try {
    await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    annualDays: formData.get("annualDays"),
    carryForwardLimit: formData.get("carryForwardLimit") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  try {
    const existing = await prisma.leaveType.findUnique({ where: { name: parsed.data.name } });
    if (existing) {
      return { error: "A leave type with that name already exists." };
    }
    await prisma.leaveType.create({
      data: {
        name: parsed.data.name,
        annualDays: parsed.data.annualDays,
        carryForwardLimit: parsed.data.carryForwardLimit ?? 0,
      },
    });
  } catch (err) {
    console.error("createLeaveType failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/leave-types");
  redirect("/dashboard/leave-types");
}

const updateSchema = z.object({
  leaveTypeId: z.string().min(1),
  annualDays: z.coerce.number().nonnegative("Must be zero or more"),
  carryForwardLimit: z.coerce.number().nonnegative("Must be zero or more"),
});

/**
 * Changing annualDays/carryForwardLimit only affects balances not yet
 * created (a future employee, a future year) — it never rewrites a
 * LeaveBalance row that already exists. See the comment on
 * ensureLeaveBalance in src/lib/leave-balance.ts.
 */
export async function updateLeaveType(
  _prevState: LeaveTypeState,
  formData: FormData
): Promise<LeaveTypeState> {
  try {
    await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = updateSchema.safeParse({
    leaveTypeId: formData.get("leaveTypeId"),
    annualDays: formData.get("annualDays"),
    carryForwardLimit: formData.get("carryForwardLimit"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  // An unchecked checkbox is simply absent from FormData — no value at
  // all, not "false" — so its presence (any value) means checked.
  const isActive = formData.get("isActive") !== null;

  try {
    await prisma.leaveType.update({
      where: { id: parsed.data.leaveTypeId },
      data: {
        annualDays: parsed.data.annualDays,
        carryForwardLimit: parsed.data.carryForwardLimit,
        isActive,
      },
    });
  } catch (err) {
    console.error("updateLeaveType failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/leave-types");
  return {};
}
