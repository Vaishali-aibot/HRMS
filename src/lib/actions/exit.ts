"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";
import { ExitChecklistItemType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { NOT_EXITABLE_STATUSES } from "@/lib/exit-constants";

export type InitiateExitState = { error?: string };

/**
 * The actual state transition (PRD §24): resignationDate/noticePeriodDays
 * recorded, lastWorkingDay computed, status -> NOTICE_PERIOD, exit
 * checklist seeded — shared by initiateExit (HR records it directly) and
 * decideResignationRequest (an employee's self-submitted request gets
 * approved). Caller is responsible for the NOT_EXITABLE_STATUSES check
 * and the EmployeeStatusHistory `reason` text.
 */
export async function commenceNoticePeriod(
  tx: Prisma.TransactionClient,
  employeeId: string,
  previousStatus: string,
  resignationDate: Date,
  noticePeriodDays: number,
  reason: string | undefined,
  changedById: string
) {
  const lastWorkingDay = new Date(resignationDate);
  lastWorkingDay.setUTCDate(lastWorkingDay.getUTCDate() + noticePeriodDays);

  await tx.employee.update({
    where: { id: employeeId },
    data: { resignationDate, noticePeriodDays, lastWorkingDay, status: "NOTICE_PERIOD" },
  });

  await tx.employeeStatusHistory.create({
    data: {
      employeeId,
      previousStatus: previousStatus as never,
      newStatus: "NOTICE_PERIOD",
      reason: reason || "Resignation recorded",
      changedById,
    },
  });

  // Exit starts the moment it's recorded — same "seed everything now"
  // pattern createEmployee uses for onboarding checklists.
  await tx.exitChecklistItem.createMany({
    data: Object.values(ExitChecklistItemType).map((type) => ({ employeeId, type })),
    skipDuplicates: true,
  });
}

const initiateSchema = z.object({
  employeeId: z.string().min(1),
  resignationDate: z.string().min(1, "Resignation date is required"),
  noticePeriodDays: z.coerce.number().int().nonnegative("Must be zero or more"),
  reason: z.string().optional().or(z.literal("")),
});

/**
 * HR records a resignation directly (skipping the employee-submits →
 * manager-approves gate that ResignationRequest/decideResignationRequest
 * in src/lib/actions/resignation.ts provides as an alternative) — realistic
 * when the conversation already happened offline and HR is just entering
 * it into the system.
 */
export async function initiateExit(
  _prevState: InitiateExitState,
  formData: FormData
): Promise<InitiateExitState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = initiateSchema.safeParse({
    employeeId: formData.get("employeeId"),
    resignationDate: formData.get("resignationDate"),
    noticePeriodDays: formData.get("noticePeriodDays"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { employeeId, noticePeriodDays, reason } = parsed.data;
  const resignationDate = new Date(parsed.data.resignationDate);

  try {
    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { status: true },
    });
    if (!existing) {
      return { error: "Employee not found." };
    }
    if (NOT_EXITABLE_STATUSES.includes(existing.status as (typeof NOT_EXITABLE_STATUSES)[number])) {
      return { error: "This employee's exit has already been initiated (or completed)." };
    }

    await prisma.$transaction((tx) =>
      commenceNoticePeriod(
        tx,
        employeeId,
        existing.status,
        resignationDate,
        noticePeriodDays,
        reason,
        session.user.id
      )
    );
  } catch (err) {
    console.error("initiateExit failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath("/dashboard/employees");
  revalidatePath("/dashboard/exits");
  redirect(`/dashboard/employees/${employeeId}`);
}

export type UpdateExitChecklistState = { error?: string };

const updateItemSchema = z.object({
  itemId: z.string().min(1),
  employeeId: z.string().min(1),
  status: z.enum(["PENDING", "COMPLETED"]),
});

export async function updateExitChecklistItem(
  _prevState: UpdateExitChecklistState,
  formData: FormData
): Promise<UpdateExitChecklistState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = updateItemSchema.safeParse({
    itemId: formData.get("itemId"),
    employeeId: formData.get("employeeId"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { itemId, status } = parsed.data;

  try {
    await prisma.exitChecklistItem.update({
      where: { id: itemId },
      data:
        status === "COMPLETED"
          ? { status, completedById: session.user.id, completedAt: new Date() }
          : { status, completedById: null, completedAt: null },
    });
  } catch (err) {
    console.error("updateExitChecklistItem failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath(`/dashboard/employees/${parsed.data.employeeId}`);
  revalidatePath("/dashboard/exits");
  return {};
}
