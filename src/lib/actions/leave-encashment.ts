"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";
import { ensureLeaveBalance } from "@/lib/leave-balance";

export type LeaveEncashmentState = { error?: string };

const requestSchema = z.object({
  leaveTypeId: z.string().min(1, "Leave type is required"),
  days: z.coerce.number().positive("Enter a number of days greater than 0"),
});

export async function requestLeaveEncashment(
  _prevState: LeaveEncashmentState,
  formData: FormData
): Promise<LeaveEncashmentState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = requestSchema.safeParse({
    leaveTypeId: formData.get("leaveTypeId"),
    days: formData.get("days"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { leaveTypeId, days } = parsed.data;

  try {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    if (!employee) {
      return { error: "Your account isn't linked to an employee record yet — contact HR." };
    }

    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType || !leaveType.isActive) {
      return { error: "Selected leave type is not available." };
    }

    const year = new Date().getFullYear();
    const balance = await prisma.$transaction((tx) =>
      ensureLeaveBalance(tx, employee.id, leaveType, year)
    );

    // Courtesy check only — decideLeaveEncashment re-checks atomically
    // right before deducting, same "two pending requests can both pass
    // this" pattern as applyForLeave.
    const remaining = balance.allocated - balance.used - balance.encashed;
    if (days > remaining) {
      return {
        error: `Not enough ${leaveType.name} balance: ${remaining} day(s) remaining, requested ${days}.`,
      };
    }

    await prisma.leaveEncashmentRequest.create({
      data: { employeeId: employee.id, leaveTypeId, year, days, status: "PENDING" },
    });
  } catch (err) {
    console.error("requestLeaveEncashment failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/leave");
  return {};
}

const decideSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionReason: z.string().optional().or(z.literal("")),
});

export async function decideLeaveEncashment(
  _prevState: LeaveEncashmentState,
  formData: FormData
): Promise<LeaveEncashmentState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = decideSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    // formData.get() returns null (not undefined) for a field the form
    // doesn't send — z.string().optional() only accepts undefined. See
    // the same normalization in decideLeaveRequest (src/lib/actions/leave.ts).
    decisionReason: formData.get("decisionReason") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { requestId, decision, decisionReason } = parsed.data;

  try {
    const request = await prisma.leaveEncashmentRequest.findUnique({
      where: { id: requestId },
      include: { employee: true, leaveType: true },
    });
    if (!request) {
      return { error: "Encashment request not found." };
    }
    if (request.status !== "PENDING") {
      return { error: "This request has already been decided." };
    }

    const isHR = HR_WRITE_ROLES.includes(session.user.role);
    let isManager = false;
    if (!isHR && session.user.role === "MANAGER") {
      const managerEmployee = await prisma.employee.findUnique({
        where: { userId: session.user.id },
      });
      isManager = !!managerEmployee && request.employee.reportingManagerId === managerEmployee.id;
    }
    if (!isHR && !isManager) {
      return { error: "You do not have permission to decide this request." };
    }

    if (decision === "APPROVED") {
      await prisma.$transaction(async (tx) => {
        const balance = await ensureLeaveBalance(tx, request.employeeId, request.leaveType, request.year);
        const remaining = balance.allocated - balance.used - balance.encashed;
        if (request.days > remaining) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { encashed: { increment: request.days } },
        });
        await tx.leaveEncashmentRequest.update({
          where: { id: requestId },
          data: {
            status: "APPROVED",
            approverId: session.user.id,
            decidedAt: new Date(),
            decisionReason: decisionReason || undefined,
          },
        });
      });
    } else {
      await prisma.leaveEncashmentRequest.update({
        where: { id: requestId },
        data: {
          status: "REJECTED",
          approverId: session.user.id,
          decidedAt: new Date(),
          decisionReason: decisionReason || undefined,
        },
      });
    }
  } catch (err) {
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return { error: "This employee no longer has enough leave balance for this request." };
    }
    console.error("decideLeaveEncashment failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/leave");
  return {};
}

const cancelSchema = z.object({ requestId: z.string().min(1) });

export async function cancelLeaveEncashment(
  _prevState: LeaveEncashmentState,
  formData: FormData
): Promise<LeaveEncashmentState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = cancelSchema.safeParse({ requestId: formData.get("requestId") });
  if (!parsed.success) {
    return { error: "Invalid request." };
  }

  try {
    const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
    if (!employee) {
      return { error: "Your account isn't linked to an employee record." };
    }
    const request = await prisma.leaveEncashmentRequest.findUnique({
      where: { id: parsed.data.requestId },
    });
    if (!request || request.employeeId !== employee.id) {
      return { error: "Encashment request not found." };
    }
    if (request.status !== "PENDING") {
      return { error: "Only pending requests can be cancelled." };
    }
    await prisma.leaveEncashmentRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED" },
    });
  } catch (err) {
    console.error("cancelLeaveEncashment failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/leave");
  return {};
}
