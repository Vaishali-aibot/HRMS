"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireSession } from "@/lib/rbac";
import { todayUTC } from "@/lib/date-only";

export type MarkAttendanceState = { error?: string };

const ALL_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "WORK_FROM_HOME",
  "HOLIDAY",
  "ON_LEAVE",
  "MISSING",
] as const;

const schema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum(ALL_STATUSES),
});

/**
 * Direct marking/overriding for someone else's record. HR can mark anyone;
 * a manager can only mark their own direct reports (checked below, not
 * just implied by the UI only showing their team) — an employee who
 * disagrees with a record goes through requestAttendanceCorrection
 * instead, and marking their OWN attendance for today goes through
 * markOwnAttendanceToday below, not this function.
 */
export async function markAttendance(
  _prevState: MarkAttendanceState,
  formData: FormData
): Promise<MarkAttendanceState> {
  let session;
  try {
    session = await requireSession();
  } catch {
    return { error: "You must be signed in to do this." };
  }

  const parsed = schema.safeParse({
    employeeId: formData.get("employeeId"),
    date: formData.get("date"),
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { employeeId, status } = parsed.data;
  const date = new Date(parsed.data.date);

  try {
    const isHR = HR_WRITE_ROLES.includes(session.user.role);
    let isManagerOfTarget = false;
    if (!isHR && session.user.role === "MANAGER") {
      const [managerEmployee, targetEmployee] = await Promise.all([
        prisma.employee.findUnique({ where: { userId: session.user.id } }),
        prisma.employee.findUnique({ where: { id: employeeId }, select: { reportingManagerId: true } }),
      ]);
      isManagerOfTarget =
        !!managerEmployee && targetEmployee?.reportingManagerId === managerEmployee.id;
    }
    if (!isHR && !isManagerOfTarget) {
      return { error: "You do not have permission to mark this employee's attendance." };
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });

    if (existing && existing.status === status) {
      return {}; // no-op save — nothing changed, nothing to audit
    }

    await prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId, date } },
        update: { status, markedById: session.user.id },
        create: { employeeId, date, status, markedById: session.user.id },
      });

      // HR/manager overriding/correcting attendance needs an audit trail
      // (PRD §13) — same AuditLog table field edits and role changes use.
      await tx.auditLog.create({
        data: {
          entityType: "AttendanceRecord",
          entityId: record.id,
          field: "status",
          oldValue: existing?.status ?? null,
          newValue: status,
          changedById: session.user.id,
        },
      });
    });
  } catch (err) {
    console.error("markAttendance failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/attendance");
  return {};
}

// Deliberately a narrower set than ALL_STATUSES — self-marking is a
// "check-in", not a way to declare yourself on leave or absent
// unsupervised. ON_LEAVE should come from an approved LeaveRequest, and
// ABSENT/LATE are exactly the judgment calls that stay HR/manager calls.
const SELF_MARK_STATUSES = ["PRESENT", "WORK_FROM_HOME", "HALF_DAY"] as const;

const selfMarkSchema = z.object({
  status: z.enum(SELF_MARK_STATUSES),
});

/**
 * Self-service "check in for today" — deliberately today-only. Editing a
 * past date is requestAttendanceCorrection's job (needs manager/HR
 * approval); this is same-day self-marking, more like a punch-in.
 */
export async function markOwnAttendanceToday(
  _prevState: MarkAttendanceState,
  formData: FormData
): Promise<MarkAttendanceState> {
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

  const parsed = selfMarkSchema.safeParse({ status: formData.get("status") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const today = todayUTC();

  try {
    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeId_date: { employeeId: employee.id, date: today } },
    });

    // Don't let a self-check-in silently overwrite something HR/a manager
    // already set today — that would defeat the whole point of keeping
    // direct marking restricted in the first place.
    if (existing && existing.markedById !== session.user.id) {
      return {
        error:
          "Today's attendance has already been recorded by HR/your manager — request a correction instead.",
      };
    }
    if (existing && existing.status === parsed.data.status) {
      return {};
    }

    await prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: employee.id, date: today } },
        update: { status: parsed.data.status, markedById: session.user.id },
        create: {
          employeeId: employee.id,
          date: today,
          status: parsed.data.status,
          markedById: session.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          entityType: "AttendanceRecord",
          entityId: record.id,
          field: "status",
          oldValue: existing?.status ?? null,
          newValue: parsed.data.status,
          reason: "Self-marked",
          changedById: session.user.id,
        },
      });
    });
  } catch (err) {
    console.error("markOwnAttendanceToday failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/attendance");
  return {};
}
