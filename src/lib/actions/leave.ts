"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";
import { ensureLeaveBalance } from "@/lib/leave-balance";

export type LeaveActionState = { error?: string };

function inclusiveDayCount(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  // Calendar days inclusive of both ends — doesn't exclude weekends/holidays.
  // A reasonable MVP scope cut; see README "Known items to revisit".
  return Math.round(ms / (24 * 60 * 60 * 1000)) + 1;
}

const applySchema = z.object({
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().optional().or(z.literal("")),
});

export async function applyForLeave(
  _prevState: LeaveActionState,
  formData: FormData
): Promise<LeaveActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) {
    return { error: "Your account isn't linked to an employee record yet — contact HR." };
  }

  const parsed = applySchema.safeParse({
    leaveTypeId: formData.get("leaveTypeId"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { leaveTypeId, reason } = parsed.data;
  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);

  if (endDate < startDate) {
    return { error: "End date can't be before the start date." };
  }
  const days = inclusiveDayCount(startDate, endDate);

  try {
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType || !leaveType.isActive) {
      return { error: "Selected leave type is not available." };
    }

    // A request spanning a year boundary is checked/deducted entirely
    // against the start-date year's balance — a disclosed simplification,
    // not a silent one (README "Known items to revisit").
    const year = startDate.getFullYear();
    const balance = await prisma.$transaction((tx) =>
      ensureLeaveBalance(tx, employee.id, leaveType, year)
    );

    // This is a courtesy check, not a reservation — two pending requests
    // can both pass it (balance is only deducted on approval). That's
    // intentional: decideLeaveRequest re-checks the balance atomically
    // right before deducting, so overdrawing is still prevented at the
    // point that actually matters.
    const remaining = balance.allocated - balance.used;
    if (days > remaining) {
      return {
        error: `Not enough ${leaveType.name} balance: ${remaining} day(s) remaining, requested ${days}.`,
      };
    }

    await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        leaveTypeId,
        startDate,
        endDate,
        days,
        reason: reason || undefined,
        status: "PENDING",
      },
    });
  } catch (err) {
    console.error("applyForLeave failed:", err);
    return { error: "Something went wrong while submitting your request. Please try again." };
  }

  revalidatePath("/dashboard/leave");
  return {};
}

const decideSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionReason: z.string().optional().or(z.literal("")),
});

export async function decideLeaveRequest(
  _prevState: LeaveActionState,
  formData: FormData
): Promise<LeaveActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = decideSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    // formData.get() returns null (not undefined) for a field that isn't
    // in the form at all (the decide forms only send requestId+decision) —
    // z.string().optional() only accepts undefined, so a bare null here
    // fails validation. Normalize before parsing.
    decisionReason: formData.get("decisionReason") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { requestId, decision, decisionReason } = parsed.data;

  try {
    const request = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { employee: true, leaveType: true },
    });
    if (!request) {
      return { error: "Leave request not found." };
    }
    if (request.status !== "PENDING") {
      return { error: "This request has already been decided." };
    }

    // HR can decide any request; a manager only their own direct reports'.
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
      const year = request.startDate.getFullYear();
      await prisma.$transaction(async (tx) => {
        const balance = await ensureLeaveBalance(tx, request.employeeId, request.leaveType, year);
        // Re-check at decision time, not just at application time — other
        // requests may have been approved in between and consumed the
        // balance this one assumed was available.
        const remaining = balance.allocated - balance.used;
        if (request.days > remaining) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: { used: { increment: request.days } },
        });
        await tx.leaveRequest.update({
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
      await prisma.leaveRequest.update({
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
    console.error("decideLeaveRequest failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/leave");
  return {};
}

const cancelSchema = z.object({ requestId: z.string().min(1) });

export async function cancelLeaveRequest(
  _prevState: LeaveActionState,
  formData: FormData
): Promise<LeaveActionState> {
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
    const request = await prisma.leaveRequest.findUnique({ where: { id: parsed.data.requestId } });
    if (!request || request.employeeId !== employee.id) {
      return { error: "Leave request not found." };
    }
    if (request.status !== "PENDING") {
      return { error: "Only pending requests can be cancelled." };
    }
    await prisma.leaveRequest.update({ where: { id: request.id }, data: { status: "CANCELLED" } });
  } catch (err) {
    console.error("cancelLeaveRequest failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/leave");
  return {};
}
