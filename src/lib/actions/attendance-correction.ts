"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";

export type CorrectionActionState = { error?: string };

const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "WORK_FROM_HOME",
  "HOLIDAY",
  "ON_LEAVE",
  "MISSING",
] as const;

function todayUTC() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const requestSchema = z.object({
  date: z.string().min(1, "Date is required"),
  requestedStatus: z.enum(ATTENDANCE_STATUSES),
  reason: z.string().min(1, "Please explain why this needs to be corrected"),
});

export async function requestAttendanceCorrection(
  _prevState: CorrectionActionState,
  formData: FormData
): Promise<CorrectionActionState> {
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
    date: formData.get("date"),
    requestedStatus: formData.get("requestedStatus"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const date = new Date(parsed.data.date);
  if (date > todayUTC()) {
    return { error: "You can't request a correction for a future date." };
  }

  try {
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date } },
    });

    if (existingRecord && existingRecord.status === parsed.data.requestedStatus) {
      return { error: "That's already the recorded status for this date." };
    }

    const duplicatePending = await prisma.attendanceCorrectionRequest.findFirst({
      where: { employeeId: employee.id, date, status: "PENDING" },
    });
    if (duplicatePending) {
      return { error: "You already have a pending correction request for this date." };
    }

    await prisma.attendanceCorrectionRequest.create({
      data: {
        employeeId: employee.id,
        date,
        currentStatus: existingRecord?.status,
        requestedStatus: parsed.data.requestedStatus,
        reason: parsed.data.reason,
      },
    });
  } catch (err) {
    console.error("requestAttendanceCorrection failed:", err);
    return { error: "Something went wrong while submitting your request. Please try again." };
  }

  revalidatePath("/dashboard/attendance");
  return {};
}

const decideSchema = z.object({
  requestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
  decisionReason: z.string().optional().or(z.literal("")),
});

export async function decideAttendanceCorrection(
  _prevState: CorrectionActionState,
  formData: FormData
): Promise<CorrectionActionState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = decideSchema.safeParse({
    requestId: formData.get("requestId"),
    decision: formData.get("decision"),
    decisionReason: formData.get("decisionReason"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { requestId, decision, decisionReason } = parsed.data;

  try {
    const request = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id: requestId },
      include: { employee: true },
    });
    if (!request) {
      return { error: "Correction request not found." };
    }
    if (request.status !== "PENDING") {
      return { error: "This request has already been decided." };
    }

    // Same authorization shape as decideLeaveRequest: HR can decide any
    // request, a manager only their own direct reports'.
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
        const existing = await tx.attendanceRecord.findUnique({
          where: { employeeId_date: { employeeId: request.employeeId, date: request.date } },
        });

        const record = await tx.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: request.employeeId, date: request.date } },
          update: { status: request.requestedStatus, markedById: session.user.id },
          create: {
            employeeId: request.employeeId,
            date: request.date,
            status: request.requestedStatus,
            markedById: session.user.id,
          },
        });

        await tx.auditLog.create({
          data: {
            entityType: "AttendanceRecord",
            entityId: record.id,
            field: "status",
            oldValue: existing?.status ?? null,
            newValue: request.requestedStatus,
            reason: `Correction request approved: ${request.reason}`,
            changedById: session.user.id,
          },
        });

        await tx.attendanceCorrectionRequest.update({
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
      await prisma.attendanceCorrectionRequest.update({
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
    console.error("decideAttendanceCorrection failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/attendance");
  return {};
}

const cancelSchema = z.object({ requestId: z.string().min(1) });

export async function cancelAttendanceCorrection(
  _prevState: CorrectionActionState,
  formData: FormData
): Promise<CorrectionActionState> {
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
    const request = await prisma.attendanceCorrectionRequest.findUnique({
      where: { id: parsed.data.requestId },
    });
    if (!request || request.employeeId !== employee.id) {
      return { error: "Correction request not found." };
    }
    if (request.status !== "PENDING") {
      return { error: "Only pending requests can be cancelled." };
    }
    await prisma.attendanceCorrectionRequest.update({
      where: { id: request.id },
      data: { status: "CANCELLED" },
    });
  } catch (err) {
    console.error("cancelAttendanceCorrection failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/attendance");
  return {};
}
