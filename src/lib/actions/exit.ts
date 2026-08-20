"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";
import { ExitChecklistItemType } from "@/generated/prisma/enums";

export type InitiateExitState = { error?: string };

const NOT_EXITABLE_STATUSES = ["NOTICE_PERIOD", "EXITED", "ALUMNI"] as const;

const initiateSchema = z.object({
  employeeId: z.string().min(1),
  resignationDate: z.string().min(1, "Resignation date is required"),
  noticePeriodDays: z.coerce.number().int().nonnegative("Must be zero or more"),
  reason: z.string().optional().or(z.literal("")),
});

/**
 * PRD §24: resignation → notice period → exit checklist, all seeded at
 * once. See the schema comment on ExitChecklistItem for the two ways this
 * simplifies the PRD's literal workflow (no separate resignation-approval
 * gate; nothing blocks EXITED before the checklist is done).
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
  const lastWorkingDay = new Date(resignationDate);
  lastWorkingDay.setUTCDate(lastWorkingDay.getUTCDate() + noticePeriodDays);

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

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id: employeeId },
        data: {
          resignationDate,
          noticePeriodDays,
          lastWorkingDay,
          status: "NOTICE_PERIOD",
        },
      });

      await tx.employeeStatusHistory.create({
        data: {
          employeeId,
          previousStatus: existing.status,
          newStatus: "NOTICE_PERIOD",
          reason: reason || "Resignation recorded",
          changedById: session.user.id,
        },
      });

      // Exit starts the moment it's recorded — same "seed everything now"
      // pattern createEmployee uses for onboarding checklists.
      await tx.exitChecklistItem.createMany({
        data: Object.values(ExitChecklistItemType).map((type) => ({
          employeeId,
          type,
        })),
        skipDuplicates: true,
      });
    });
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
