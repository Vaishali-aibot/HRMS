"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";

const createEmployeeSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  personalEmail: z.string().email().optional().or(z.literal("")),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  location: z.string().optional().or(z.literal("")),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]),
  workMode: z.enum(["ON_SITE", "REMOTE", "HYBRID"]),
  reportingManagerId: z.string().optional().or(z.literal("")),
});

export type CreateEmployeeState = {
  ok: boolean;
  error?: string;
};

/**
 * Generates the next human-readable employee code (EMP-0001, EMP-0002, ...).
 * Good enough for MVP volumes; move to a DB sequence if joiner volume grows.
 */
async function nextEmployeeCode() {
  const count = await prisma.employee.count();
  return `EMP-${String(count + 1).padStart(4, "0")}`;
}

export async function createEmployee(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  const session = await requireRole("HR_ADMIN", "HR_EXECUTIVE");

  const parsed = createEmployeeSchema.safeParse({
    fullName: formData.get("fullName"),
    personalEmail: formData.get("personalEmail"),
    dateOfJoining: formData.get("dateOfJoining"),
    department: formData.get("department"),
    designation: formData.get("designation"),
    location: formData.get("location"),
    employmentType: formData.get("employmentType"),
    workMode: formData.get("workMode"),
    reportingManagerId: formData.get("reportingManagerId"),
  });

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const employeeCode = await nextEmployeeCode();

  const employee = await prisma.employee.create({
    data: {
      employeeCode,
      fullName: data.fullName,
      personalEmail: data.personalEmail || undefined,
      dateOfJoining: new Date(data.dateOfJoining),
      department: data.department,
      designation: data.designation,
      location: data.location || undefined,
      employmentType: data.employmentType,
      workMode: data.workMode,
      reportingManagerId: data.reportingManagerId || undefined,
      status: "PRE_BOARDING",
    },
  });

  await prisma.employeeStatusHistory.create({
    data: {
      employeeId: employee.id,
      previousStatus: null,
      newStatus: "PRE_BOARDING",
      reason: "Employee record created",
      changedById: session.user.id,
    },
  });

  revalidatePath("/dashboard/employees");
  return { ok: true };
}
