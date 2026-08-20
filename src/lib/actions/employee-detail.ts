"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";
import type { Employee } from "@/generated/prisma/client";

const updateEmployeeSchema = z.object({
  employeeId: z.string().min(1),
  fullName: z.string().min(1, "Full name is required"),
  personalEmail: z.string().email().optional().or(z.literal("")),
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Designation is required"),
  location: z.string().optional().or(z.literal("")),
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "INTERN"]),
  workMode: z.enum(["ON_SITE", "REMOTE", "HYBRID"]),
  // Populated from a <select> of real employees — never free text (see the
  // reporting-manager fix on the create form for why that matters).
  reportingManagerId: z.string().optional().or(z.literal("")),
});

export type UpdateEmployeeState = { error?: string };

// Fields the edit form can change, and therefore the only fields this
// action ever audits. Compensation/bank/statutory fields aren't editable
// here yet (PRD §7/§30 — need tighter field-level RBAC first).
const AUDITABLE_FIELDS = [
  "fullName",
  "personalEmail",
  "department",
  "designation",
  "location",
  "employmentType",
  "workMode",
  "reportingManagerId",
] as const satisfies readonly (keyof Employee)[];

export async function updateEmployee(
  _prevState: UpdateEmployeeState,
  formData: FormData
): Promise<UpdateEmployeeState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = updateEmployeeSchema.safeParse({
    employeeId: formData.get("employeeId"),
    fullName: formData.get("fullName"),
    personalEmail: formData.get("personalEmail"),
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

  // Only catches the immediate cycle (an employee reporting to themselves).
  // Deeper cycles (A -> B -> A) aren't checked yet — a reasonable MVP scope
  // cut given org charts are usually shallow and HR-curated, but worth
  // hardening before this app scales past a small team.
  if (reportingManagerId === data.employeeId) {
    return { error: "An employee cannot be their own reporting manager." };
  }

  try {
    const existing = await prisma.employee.findUnique({ where: { id: data.employeeId } });
    if (!existing) {
      return { error: "Employee not found." };
    }

    if (reportingManagerId) {
      const managerExists = await prisma.employee.findUnique({
        where: { id: reportingManagerId },
        select: { id: true },
      });
      if (!managerExists) {
        return { error: "Selected reporting manager no longer exists." };
      }
    }

    // Explicit `null` (not `undefined`) for clearable fields — in Prisma's
    // update `data`, `undefined` means "leave unchanged", so using it here
    // would silently fail to clear a field the user emptied on the form.
    // (No uniform type annotation here on purpose — letting each property's
    // type be inferred from its own literal is what makes this satisfy
    // Prisma's per-field update input types, e.g. `fullName: string` vs
    // `personalEmail: string | null`.)
    const nextValues = {
      fullName: data.fullName,
      personalEmail: data.personalEmail || null,
      department: data.department,
      designation: data.designation,
      location: data.location || null,
      employmentType: data.employmentType,
      workMode: data.workMode,
      reportingManagerId: reportingManagerId ?? null,
    };

    const changedFields = AUDITABLE_FIELDS.filter((field) => {
      const before = existing[field] ?? null;
      return before !== nextValues[field];
    });

    if (changedFields.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.employee.update({
          where: { id: data.employeeId },
          data: nextValues,
        });

        await tx.auditLog.createMany({
          data: changedFields.map((field) => ({
            entityType: "Employee",
            entityId: data.employeeId,
            field,
            oldValue: existing[field] != null ? String(existing[field]) : null,
            newValue: nextValues[field] != null ? String(nextValues[field]) : null,
            changedById: session.user.id,
          })),
        });
      });
    }
  } catch (err) {
    console.error("updateEmployee failed:", err);
    return { error: "Something went wrong while saving. Please try again." };
  }

  revalidatePath(`/dashboard/employees/${data.employeeId}`);
  revalidatePath("/dashboard/employees");
  redirect(`/dashboard/employees/${data.employeeId}`);
}

const changeStatusSchema = z.object({
  employeeId: z.string().min(1),
  newStatus: z.enum([
    "CANDIDATE",
    "OFFER_ACCEPTED",
    "PRE_BOARDING",
    "ONBOARDING",
    "PROBATION",
    "CONFIRMED",
    "ACTIVE",
    "NOTICE_PERIOD",
    "EXITED",
    "ALUMNI",
  ]),
  reason: z.string().optional().or(z.literal("")),
});

export type ChangeStatusState = { error?: string };

export async function changeEmployeeStatus(
  _prevState: ChangeStatusState,
  formData: FormData
): Promise<ChangeStatusState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const parsed = changeStatusSchema.safeParse({
    employeeId: formData.get("employeeId"),
    newStatus: formData.get("newStatus"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { employeeId, newStatus, reason } = parsed.data;

  try {
    const existing = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { status: true },
    });
    if (!existing) {
      return { error: "Employee not found." };
    }
    if (existing.status === newStatus) {
      return { error: "Employee is already in that status." };
    }

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({ where: { id: employeeId }, data: { status: newStatus } });
      await tx.employeeStatusHistory.create({
        data: {
          employeeId,
          previousStatus: existing.status,
          newStatus,
          reason: reason || undefined,
          changedById: session.user.id,
        },
      });
    });
  } catch (err) {
    console.error("changeEmployeeStatus failed:", err);
    return { error: "Something went wrong while updating status. Please try again." };
  }

  revalidatePath(`/dashboard/employees/${employeeId}`);
  revalidatePath("/dashboard/employees");
  redirect(`/dashboard/employees/${employeeId}`);
}
