"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";
import { DocumentType, ITTaskType } from "@/generated/prisma/enums";

const createEmployeeSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  personalEmail: z.string().email().optional().or(z.literal("")),
  dateOfJoining: z.string().min(1, "Date of joining is required"),
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  location: z.string().optional().or(z.literal("")),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]),
  workMode: z.enum(["ON_SITE", "REMOTE", "HYBRID"]),
  // This is Employee.id (an internal cuid), populated from a <select> of
  // existing employees in the form — never free text. See
  // src/app/dashboard/employees/new/employee-form.tsx.
  reportingManagerId: z.string().optional().or(z.literal("")),
});

export type CreateEmployeeState = {
  error?: string;
};

const GENERIC_ERROR =
  "Something went wrong while creating the employee. Please try again.";

export async function createEmployee(
  _prevState: CreateEmployeeState,
  formData: FormData
): Promise<CreateEmployeeState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    // Don't leak internal role names to whoever/whatever called this —
    // requireRole's message is for logs/dev, not the client.
    return { error: "You do not have permission to perform this action." };
  }

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
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const reportingManagerId = data.reportingManagerId || undefined;

  try {
    if (reportingManagerId) {
      // Defense in depth: the form only ever submits a real Employee.id via
      // a <select>, but a direct POST could send anything — validate here
      // rather than let it surface as an uncaught FK constraint violation.
      const managerExists = await prisma.employee.findUnique({
        where: { id: reportingManagerId },
        select: { id: true },
      });
      if (!managerExists) {
        return { error: "Selected reporting manager no longer exists." };
      }
    }

    await prisma.$transaction(async (tx) => {
      // Atomic counter increment (not count()+1) so two concurrent creates
      // can never compute the same employeeCode.
      const counter = await tx.counter.upsert({
        where: { name: "employeeCode" },
        update: { value: { increment: 1 } },
        create: { name: "employeeCode", value: 1 },
      });
      const employeeCode = `EMP-${String(counter.value).padStart(4, "0")}`;

      const employee = await tx.employee.create({
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
          reportingManagerId,
          status: "PRE_BOARDING",
        },
      });

      // Same transaction as the employee insert — never leave an Employee
      // row with no corresponding lifecycle-history row.
      await tx.employeeStatusHistory.create({
        data: {
          employeeId: employee.id,
          previousStatus: null,
          newStatus: "PRE_BOARDING",
          reason: "Employee record created",
          changedById: session.user.id,
        },
      });

      // Onboarding starts automatically the moment the record exists (PRD
      // §10/§11): one checklist row per document/IT task type, all
      // NOT_SUBMITTED/PENDING until HR or IT updates them.
      await tx.onboardingDocument.createMany({
        data: Object.values(DocumentType).map((type) => ({
          employeeId: employee.id,
          type,
        })),
      });
      await tx.iTOnboardingTask.createMany({
        data: Object.values(ITTaskType).map((type) => ({
          employeeId: employee.id,
          type,
        })),
      });
    });
  } catch (err) {
    console.error("createEmployee failed:", err);
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/dashboard/employees");
  redirect("/dashboard/employees");
}
