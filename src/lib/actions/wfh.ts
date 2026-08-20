"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";

export type WFHActionState = { error?: string };

const MAX_REQUEST_DAYS = 31;

function inclusiveDayCount(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000)) + 1;
}

function eachDateInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * PRD §15 policy: eligibility (by employment type), location restriction,
 * and max-days limits — enforced here, checked both when an employee
 * applies (a courtesy — same "two pending requests can both pass this"
 * caveat as applyForLeave) and again in decideWFHRequest right before
 * approving (the point that actually matters). Returns an error message,
 * or null if the request is allowed.
 *
 * Max-days usage is attributed to each existing request's own start-date
 * year/month — same disclosed simplification as leave.ts's year-boundary
 * handling — not a precise per-day breakdown for requests spanning a
 * month/year boundary.
 */
async function checkWFHPolicy(
  employee: { id: string; employmentType: string; location: string | null },
  startDate: Date,
  days: number
): Promise<string | null> {
  const policy = await prisma.wFHPolicy.findUnique({ where: { id: "default" } });
  if (!policy) return null;

  if (
    policy.eligibleEmploymentTypes.length > 0 &&
    !policy.eligibleEmploymentTypes.includes(employee.employmentType as never)
  ) {
    return "Your employment type isn't eligible for WFH under the current policy.";
  }

  if (policy.allowedLocations.length > 0) {
    const allowed = employee.location
      ? policy.allowedLocations.some(
          (loc) => loc.toLowerCase() === employee.location!.toLowerCase()
        )
      : false;
    if (!allowed) {
      return "WFH isn't available for your location under the current policy.";
    }
  }

  if (policy.maxDaysPerMonth != null || policy.maxDaysPerYear != null) {
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth();
    const approved = await prisma.wFHRequest.findMany({
      where: { employeeId: employee.id, status: "APPROVED" },
      select: { startDate: true, endDate: true },
    });
    let usedThisYear = 0;
    let usedThisMonth = 0;
    for (const r of approved) {
      const d = inclusiveDayCount(r.startDate, r.endDate);
      if (r.startDate.getUTCFullYear() === year) {
        usedThisYear += d;
        if (r.startDate.getUTCMonth() === month) usedThisMonth += d;
      }
    }
    if (policy.maxDaysPerYear != null && usedThisYear + days > policy.maxDaysPerYear) {
      return `This would exceed the yearly WFH limit of ${policy.maxDaysPerYear} day(s) (${usedThisYear} already approved this year).`;
    }
    if (policy.maxDaysPerMonth != null && usedThisMonth + days > policy.maxDaysPerMonth) {
      return `This would exceed the monthly WFH limit of ${policy.maxDaysPerMonth} day(s) (${usedThisMonth} already approved this month).`;
    }
  }

  return null;
}

const requestSchema = z.object({
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  reason: z.string().min(1, "Please give a reason"),
});

export async function requestWFH(
  _prevState: WFHActionState,
  formData: FormData
): Promise<WFHActionState> {
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

  const parsed = requestSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (endDate < startDate) {
    return { error: "End date can't be before the start date." };
  }
  if (inclusiveDayCount(startDate, endDate) > MAX_REQUEST_DAYS) {
    return { error: `A single request can't span more than ${MAX_REQUEST_DAYS} days.` };
  }

  const policyError = await checkWFHPolicy(employee, startDate, inclusiveDayCount(startDate, endDate));
  if (policyError) {
    return { error: policyError };
  }

  try {
    await prisma.wFHRequest.create({
      data: {
        employeeId: employee.id,
        startDate,
        endDate,
        reason: parsed.data.reason,
        status: "PENDING",
      },
    });
  } catch (err) {
    console.error("requestWFH failed:", err);
    return { error: "Something went wrong while submitting your request. Please try again." };
  }

  revalidatePath("/dashboard/wfh");
  return {};
}

const decideSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionReason: z.string().optional().or(z.literal("")),
});

export async function decideWFHRequest(
  _prevState: WFHActionState,
  formData: FormData
): Promise<WFHActionState> {
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
    const request = await prisma.wFHRequest.findUnique({
      where: { id: requestId },
      include: { employee: true },
    });
    if (!request) {
      return { error: "WFH request not found." };
    }
    if (request.status !== "PENDING") {
      return { error: "This request has already been decided." };
    }

    // Same authorization shape as leave/correction decisions: HR decides
    // any request, a manager only their own direct reports'.
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
      // The real enforcement point (application-time was only a courtesy
      // check) — re-check right before approving, since other requests
      // may have been approved in between.
      const policyError = await checkWFHPolicy(
        request.employee,
        request.startDate,
        inclusiveDayCount(request.startDate, request.endDate)
      );
      if (policyError) {
        return { error: policyError };
      }

      await prisma.$transaction(async (tx) => {
        // Authoritative override, same as an approved attendance
        // correction — writes WORK_FROM_HOME onto every covered date.
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

        await tx.wFHRequest.update({
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
      await prisma.wFHRequest.update({
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
    console.error("decideWFHRequest failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/wfh");
  revalidatePath("/dashboard/attendance");
  return {};
}

const cancelSchema = z.object({ requestId: z.string().min(1) });

export async function cancelWFHRequest(
  _prevState: WFHActionState,
  formData: FormData
): Promise<WFHActionState> {
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
    const request = await prisma.wFHRequest.findUnique({ where: { id: parsed.data.requestId } });
    if (!request || request.employeeId !== employee.id) {
      return { error: "WFH request not found." };
    }
    if (request.status !== "PENDING") {
      return { error: "Only pending requests can be cancelled." };
    }
    await prisma.wFHRequest.update({ where: { id: request.id }, data: { status: "CANCELLED" } });
  } catch (err) {
    console.error("cancelWFHRequest failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/wfh");
  return {};
}
