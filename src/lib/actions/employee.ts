"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";
import { DocumentType, ITTaskType } from "@/generated/prisma/enums";
import type { EmploymentStatus, EmploymentType, WorkMode } from "@/generated/prisma/enums";
import { DEFAULT_LEAVE_TYPES, ensureLeaveBalance } from "@/lib/leave-balance";
import { addMonthsClamped } from "@/lib/date-only";

export type NewEmployeeInput = {
  fullName: string;
  personalEmail?: string;
  workEmail?: string;
  panNumber?: string;
  dateOfBirth?: Date;
  dateOfJoining: Date;
  department: string;
  designation: string;
  location?: string;
  employmentType: EmploymentType;
  workMode: WorkMode;
  reportingManagerId?: string;
  /** Explicit employeeCode to use instead of the auto-incrementing counter
   * (e.g. a bulk import preserving the source spreadsheet's own
   * numbering). When provided, the persistent counter is also bumped up
   * to at least this value, so a later "Add employee" never collides
   * with an imported code. */
  employeeCode?: string;
  /** Defaults to PRE_BOARDING — the normal new-joiner path. */
  status?: EmploymentStatus;
  /** null = don't track probation at all (e.g. importing an employee who's
   * long past it); undefined = compute the default 3-calendar-month date
   * from dateOfJoining, same as the "Add employee" form's default. */
  probationEndDate?: Date | null;
  /** False skips seeding OnboardingDocument/ITOnboardingTask rows — for
   * importing an already-ACTIVE employee, those checklists would just be
   * permanently-pending noise (PRD's onboarding flow doesn't apply to them
   * retroactively). Leave balances are always seeded regardless — every
   * employee needs those whether they're new or already active. */
  seedOnboarding?: boolean;
  changedById?: string;
  statusReason?: string;
};

/**
 * The actual Employee-row-plus-everything-that-comes-with-it creation
 * logic (employeeCode, status history, onboarding checklist seeding, leave
 * balances) — shared by the single "Add employee" form action below and
 * the bulk import action (src/lib/actions/employee-import.ts), so both
 * produce a fully-seeded record the same way rather than the importer
 * reimplementing (and risking drifting from) this.
 */
export async function createEmployeeRecord(data: NewEmployeeInput) {
  return prisma.$transaction(async (tx) => {
    let employeeCode: string;
    if (data.employeeCode) {
      employeeCode = data.employeeCode;
      // Keep the persistent counter in sync so a subsequent
      // counter-generated code (the single "Add employee" form) never
      // collides with an explicitly-numbered import.
      const numericPart = Number(employeeCode.replace(/\D/g, ""));
      if (Number.isFinite(numericPart) && numericPart > 0) {
        const current = await tx.counter.findUnique({ where: { name: "employeeCode" } });
        if (!current) {
          await tx.counter.create({ data: { name: "employeeCode", value: numericPart } });
        } else if (numericPart > current.value) {
          await tx.counter.update({ where: { name: "employeeCode" }, data: { value: numericPart } });
        }
      }
    } else {
      // Atomic counter increment (not count()+1) so two concurrent creates
      // can never compute the same employeeCode.
      const counter = await tx.counter.upsert({
        where: { name: "employeeCode" },
        update: { value: { increment: 1 } },
        create: { name: "employeeCode", value: 1 },
      });
      employeeCode = `EMP-${String(counter.value).padStart(4, "0")}`;
    }

    const status = data.status ?? "PRE_BOARDING";

    const employee = await tx.employee.create({
      data: {
        employeeCode,
        fullName: data.fullName,
        personalEmail: data.personalEmail || undefined,
        workEmail: data.workEmail || undefined,
        panNumber: data.panNumber || undefined,
        dateOfBirth: data.dateOfBirth,
        dateOfJoining: data.dateOfJoining,
        probationEndDate: data.probationEndDate ?? undefined,
        department: data.department,
        designation: data.designation,
        location: data.location || undefined,
        employmentType: data.employmentType,
        workMode: data.workMode,
        reportingManagerId: data.reportingManagerId || undefined,
        status,
      },
    });

    // Same transaction as the employee insert — never leave an Employee
    // row with no corresponding lifecycle-history row.
    await tx.employeeStatusHistory.create({
      data: {
        employeeId: employee.id,
        previousStatus: null,
        newStatus: status,
        reason: data.statusReason ?? "Employee record created",
        changedById: data.changedById,
      },
    });

    if (data.seedOnboarding !== false) {
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
    }

    // Leave entitlement, same idea (PRD §14): give the employee a balance
    // for every active leave type for the current year. Monthly-capped
    // types (WFH) never get a LeaveBalance row — there's no annual pool to
    // seed; "remaining" is computed fresh from approved requests instead
    // (see getMonthlyCapRemaining).
    await tx.leaveType.createMany({ data: DEFAULT_LEAVE_TYPES, skipDuplicates: true });
    const leaveTypes = await tx.leaveType.findMany({
      where: { isActive: true, monthlyCap: null },
    });
    const currentYear = new Date().getFullYear();
    for (const leaveType of leaveTypes) {
      await ensureLeaveBalance(tx, employee.id, leaveType, currentYear);
    }

    return employee;
  });
}

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
  // Probation start is implicitly dateOfJoining (PRD §16 — no separate
  // model field for it); this is just the duration used to calculate
  // probationEndDate. Blank = the 3-calendar-month company default (see
  // DEFAULT_PROBATION_MONTHS below) — a custom value here is always in
  // exact days, not months, since that's what the field asks for.
  probationPeriodDays: z.coerce.number().int().positive().optional(),
});

const DEFAULT_PROBATION_MONTHS = 3;

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
    probationPeriodDays: formData.get("probationPeriodDays") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const data = parsed.data;
  const reportingManagerId = data.reportingManagerId || undefined;
  const dateOfJoining = new Date(data.dateOfJoining);
  let probationEndDate: Date;
  if (data.probationPeriodDays != null) {
    // Explicit override — always exact days, since that's what the field
    // label asks for.
    probationEndDate = new Date(dateOfJoining);
    probationEndDate.setUTCDate(probationEndDate.getUTCDate() + data.probationPeriodDays);
  } else {
    // Default — calendar months, not a flat 90-day stand-in for "3 months"
    // (which under/overshoots the actual 3-month mark by a day or two
    // depending on which months are spanned). Uses addMonthsClamped, not
    // plain setUTCMonth, so a month-end join date (e.g. Jan 31) clamps to
    // the target month's last day (Apr 30) instead of rolling over into
    // the next month (May 1) — matching what a SQL `+ INTERVAL '3
    // months'` recompute would produce for the same join date.
    probationEndDate = addMonthsClamped(dateOfJoining, DEFAULT_PROBATION_MONTHS);
  }

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

    await createEmployeeRecord({
      fullName: data.fullName,
      personalEmail: data.personalEmail,
      dateOfJoining,
      probationEndDate,
      department: data.department,
      designation: data.designation,
      location: data.location,
      employmentType: data.employmentType,
      workMode: data.workMode,
      reportingManagerId,
      changedById: session.user.id,
    });
  } catch (err) {
    console.error("createEmployee failed:", err);
    return { error: GENERIC_ERROR };
  }

  revalidatePath("/dashboard/employees");
  redirect("/dashboard/employees");
}
