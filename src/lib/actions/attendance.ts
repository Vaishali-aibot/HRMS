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
    // HR-only for now — no manager/self-service marking or correction
    // requests yet. See README "Known items to revisit".
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
    await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId, date } },
      update: { status, markedById: session.user.id },
      create: { employeeId, date, status, markedById: session.user.id },
    });
  } catch (err) {
    console.error("markAttendance failed:", err);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard/attendance");
  return {};
}
