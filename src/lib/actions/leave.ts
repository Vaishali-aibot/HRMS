"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";
import { ensureLeaveBalance, getMonthlyCapRemaining, remainingFromBalance } from "@/lib/leave-balance";
import { DATE_ONLY_PATTERN, eachDateInRange, inclusiveDayCount } from "@/lib/date-only";
import { checkWFHEligibility } from "@/lib/wfh-eligibility";

export type LeaveActionState = { error?: string };

// A single-request guardrail independent of any balance/cap check — the
// old standalone WFH module had this (MAX_REQUEST_DAYS = 31) and it didn't
// carry over when WFH was folded into this unified flow. Applied to every
// leave type, not just WFH: it's cheap input-sanity defense-in-depth
// against a pathologically large date range reaching decideLeaveRequest's
// per-day attendance-record loop (for marksAttendanceAsWFH types), not a
// substitute for the real balance/monthlyCap checks below.
const MAX_REQUEST_DAYS = 31;

/**
 * Remaining balance for one leave type as of a given reference date —
 * `remaining` at page-load time is only ever computed for "today," so a
 * monthly-capped type's (WFH) figure is stale the moment the user picks a
 * date in a different month. The apply form calls this whenever the
 * selected leave type or start date changes, so the Apply-button gate
 * reflects the month the user is actually requesting, not the month the
 * page happened to load in. See the caveats on ensureLeaveBalance/
 * getMonthlyCapRemaining in src/lib/leave-balance.ts — same "courtesy
 * check, not a reservation" caveat applies here too.
 */
export async function getLeaveTypeRemaining(
  leaveTypeId: string,
  referenceDateStr: string
): Promise<{ remaining: number } | { error: string }> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }
  if (!DATE_ONLY_PATTERN.test(referenceDateStr)) {
    return { error: "Invalid date." };
  }

  const employee = await prisma.employee.findUnique({ where: { userId: session.user.id } });
  if (!employee) {
    return { error: "Your account isn't linked to an employee record." };
  }

  const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
  if (!leaveType || !leaveType.isActive) {
    return { error: "Selected leave type is not available." };
  }

  const referenceDate = new Date(referenceDateStr);

  if (leaveType.monthlyCap != null) {
    const remaining = await getMonthlyCapRemaining(
      prisma,
      employee.id,
      leaveType.id,
      leaveType.monthlyCap,
      referenceDate
    );
    return { remaining };
  }

  const year = referenceDate.getUTCFullYear();
  const balance = await prisma.$transaction((tx) =>
    ensureLeaveBalance(tx, employee.id, leaveType, year)
  );
  return { remaining: remainingFromBalance(balance) };
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
  if (days > MAX_REQUEST_DAYS) {
    return { error: `A single request can't span more than ${MAX_REQUEST_DAYS} days.` };
  }

  try {
    const leaveType = await prisma.leaveType.findUnique({ where: { id: leaveTypeId } });
    if (!leaveType || !leaveType.isActive) {
      return { error: "Selected leave type is not available." };
    }

    // WFH requests need a reason (what they'll be doing/why), same as
    // before this was folded into the general leave flow — other types
    // stay optional.
    if (leaveType.marksAttendanceAsWFH && !reason) {
      return { error: "Please give a reason." };
    }

    // Employment-type/location eligibility and the yearly cap — the part
    // of the old standalone WFH module's policy that doesn't map onto
    // LeaveType.monthlyCap. Courtesy check only, same caveat as the
    // balance check below: decideLeaveRequest re-checks atomically.
    if (leaveType.marksAttendanceAsWFH) {
      const eligibilityError = await checkWFHEligibility(
        prisma,
        employee,
        leaveType.id,
        startDate,
        days
      );
      if (eligibilityError) {
        return { error: eligibilityError };
      }
    }

    if (leaveType.monthlyCap != null) {
      // Monthly-capped type (WFH) — no annual pool, remaining is computed
      // fresh from approved requests in the request's month. Same courtesy-
      // check caveat as below: decideLeaveRequest re-checks atomically.
      const remaining = await getMonthlyCapRemaining(
        prisma,
        employee.id,
        leaveType.id,
        leaveType.monthlyCap,
        startDate
      );
      if (days > remaining) {
        return {
          error: `Not enough ${leaveType.name} balance: ${remaining} day(s) remaining this month, requested ${days}.`,
        };
      }
    } else {
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
      const remaining = remainingFromBalance(balance);
      if (days > remaining) {
        return {
          error: `Not enough ${leaveType.name} balance: ${remaining} day(s) remaining, requested ${days}.`,
        };
      }
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
      await prisma.$transaction(async (tx) => {
        // Authoritative re-check of employment-type/location eligibility
        // and the yearly cap, right before approving — mirrors the
        // balance re-check below for the same reason (an approval can be
        // decided well after application, or the policy/employee's
        // details can have changed in between).
        if (request.leaveType.marksAttendanceAsWFH) {
          const eligibilityError = await checkWFHEligibility(
            tx,
            request.employee,
            request.leaveTypeId,
            request.startDate,
            request.days
          );
          if (eligibilityError) {
            throw new Error(`WFH_POLICY: ${eligibilityError}`);
          }
        }

        if (request.leaveType.monthlyCap != null) {
          // Re-check at decision time, not just at application time — other
          // requests may have been approved in between and consumed the
          // month's cap this one assumed was available. No LeaveBalance row
          // to update for a monthlyCap type — "used" is always derived from
          // approved LeaveRequest rows (see getMonthlyCapRemaining).
          const remaining = await getMonthlyCapRemaining(
            tx,
            request.employeeId,
            request.leaveTypeId,
            request.leaveType.monthlyCap,
            request.startDate
          );
          if (request.days > remaining) {
            throw new Error("INSUFFICIENT_BALANCE");
          }
        } else {
          const year = request.startDate.getFullYear();
          const balance = await ensureLeaveBalance(tx, request.employeeId, request.leaveType, year);
          const remaining = remainingFromBalance(balance);
          if (request.days > remaining) {
            throw new Error("INSUFFICIENT_BALANCE");
          }
          await tx.leaveBalance.update({
            where: { id: balance.id },
            data: { used: { increment: request.days } },
          });
        }

        // WFH-flagged types also write an authoritative WORK_FROM_HOME
        // attendance record for every covered date, same as the old
        // dedicated WFH approval flow did.
        if (request.leaveType.marksAttendanceAsWFH) {
          for (const date of eachDateInRange(request.startDate, request.endDate)) {
            const existing = await tx.attendanceRecord.findUnique({
              where: { employeeId_date: { employeeId: request.employeeId, date } },
            });
            const record = await tx.attendanceRecord.upsert({
              where: { employeeId_date: { employeeId: request.employeeId, date } },
              update: { status: "WORK_FROM_HOME", markedById: session.user.id },
              create: {
                employeeId: request.employeeId,
                date,
                status: "WORK_FROM_HOME",
                markedById: session.user.id,
              },
            });
            if (!existing || existing.status !== "WORK_FROM_HOME") {
              await tx.auditLog.create({
                data: {
                  entityType: "AttendanceRecord",
                  entityId: record.id,
                  field: "status",
                  oldValue: existing?.status ?? null,
                  newValue: "WORK_FROM_HOME",
                  reason: `WFH request approved: ${request.reason}`,
                  changedById: session.user.id,
                },
              });
            }
          }
        }

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
    if (err instanceof Error && err.message.startsWith("WFH_POLICY: ")) {
      return { error: err.message.slice("WFH_POLICY: ".length) };
    }
    console.error("decideLeaveRequest failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/leave");
  revalidatePath("/dashboard/attendance");
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
