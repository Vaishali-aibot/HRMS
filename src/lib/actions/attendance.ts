"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";

export type MarkAttendanceState = { error?: string };

const schema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1),
  status: z.enum([
    "PRESENT",
    "ABSENT",
    "LATE",
    "HALF_DAY",
    "WORK_FROM_HOME",
    "HOLIDAY",
    "ON_LEAVE",
    "MISSING",
  ]),
});

export async function markAttendance(
  _prevState: MarkAttendanceState,
  formData: FormData
): Promise<MarkAttendanceState> {
  let session;
  try {
    // Direct marking/overriding is HR-only — a manager or employee who
    // disagrees with a record goes through requestAttendanceCorrection
    // instead (src/lib/actions/attendance-correction.ts).
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
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

      // HR overriding/correcting attendance needs an audit trail (PRD
      // §13) — same AuditLog table field edits and role changes use.
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
