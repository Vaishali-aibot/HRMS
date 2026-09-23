"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import ExcelJS from "exceljs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { HR_WRITE_ROLES, requireRole } from "@/lib/rbac";
import { createEmployeeRecord } from "@/lib/actions/employee";
import { IMPORT_SHEET_NAME, findImportSheet, parseImportSheet } from "@/lib/employee-import-parse";
import type { ParsedEmployeeRow } from "@/lib/employee-import-parse";

export type { ParsedEmployeeRow };

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB — a roster spreadsheet is tiny; this is a sanity cap, not a real limit

export type PreviewImportState = {
  error?: string;
  rows?: ParsedEmployeeRow[];
};

export async function previewImportEmployees(
  _prevState: PreviewImportState,
  formData: FormData
): Promise<PreviewImportState> {
  try {
    await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose an Excel file (.xlsx)." };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { error: "File is too large (max 5MB)." };
  }

  let workbook: ExcelJS.Workbook;
  try {
    const buffer = await file.arrayBuffer();
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as never);
  } catch (err) {
    console.error("Failed to parse uploaded workbook:", err);
    return { error: "Couldn't read that file — is it a valid .xlsx?" };
  }

  const sheet = findImportSheet(workbook);
  if (!sheet) {
    return {
      error: `No sheet named "${IMPORT_SHEET_NAME}" found. Available sheets: ${workbook.worksheets
        .map((s) => s.name)
        .join(", ")}`,
    };
  }

  // Existing employees, for the name-based duplicate match — fetched once
  // rather than per row.
  const existing = await prisma.employee.findMany({
    select: { id: true, employeeCode: true, fullName: true },
  });

  return parseImportSheet(sheet, existing);
}

const rowDecisionSchema = z.object({
  key: z.string(),
  action: z.enum(["create", "update", "skip"]),
  employeeIdRef: z.string().nullable(),
  fullName: z.string().nullable(),
  workEmail: z.string().nullable(),
  panNumber: z.string().nullable(),
  designation: z.string().nullable(),
  department: z.string().nullable(),
  managerEmail: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  dateOfJoining: z.string().nullable(),
  matchedEmployeeId: z.string().nullable(),
});

export type ConfirmImportState = { error?: string };

export async function confirmImportEmployees(
  _prevState: ConfirmImportState,
  formData: FormData
): Promise<ConfirmImportState> {
  let session;
  try {
    session = await requireRole(...HR_WRITE_ROLES);
  } catch {
    return { error: "You do not have permission to perform this action." };
  }

  const raw = formData.get("rows");
  if (typeof raw !== "string") {
    return { error: "Invalid request." };
  }
  let decisions;
  try {
    decisions = z.array(rowDecisionSchema).parse(JSON.parse(raw));
  } catch (err) {
    console.error("confirmImportEmployees: bad rows payload:", err);
    return { error: "Invalid request." };
  }

  // employeeId, keyed by workEmail — used to resolve "Manager" references
  // after every create/update in this batch is done, so it doesn't matter
  // whether a manager appears earlier or later in the sheet than their
  // report, or is an existing (not newly created) employee.
  const idByWorkEmail = new Map<string, string>();
  for (const e of await prisma.employee.findMany({
    where: { workEmail: { not: null } },
    select: { id: true, workEmail: true },
  })) {
    if (e.workEmail) idByWorkEmail.set(e.workEmail.toLowerCase(), e.id);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  try {
    for (const row of decisions) {
      if (row.action === "skip") {
        skipped++;
        // Still opportunistically backfill workEmail on the matched
        // existing record if it doesn't have one yet — low-risk (additive
        // only, never overwrites) and is what lets auto-link-on-sign-in
        // and manager resolution work for people HR chose not to
        // otherwise touch.
        if (row.matchedEmployeeId && row.workEmail) {
          const existing = await prisma.employee.findUnique({
            where: { id: row.matchedEmployeeId },
            select: { workEmail: true },
          });
          if (existing && !existing.workEmail) {
            await prisma.employee.update({
              where: { id: row.matchedEmployeeId },
              data: { workEmail: row.workEmail },
            });
          }
          idByWorkEmail.set(row.workEmail.toLowerCase(), row.matchedEmployeeId);
        }
        continue;
      }

      if (row.action === "update" && row.matchedEmployeeId) {
        const existing = await prisma.employee.findUnique({
          where: { id: row.matchedEmployeeId },
          select: {
            workEmail: true,
            panNumber: true,
            dateOfBirth: true,
            department: true,
            designation: true,
          },
        });
        if (!existing) {
          skipped++;
          continue;
        }
        // Only fill gaps — never overwrite a value that's already set,
        // since the existing record may have been edited since this
        // spreadsheet was last exported.
        await prisma.employee.update({
          where: { id: row.matchedEmployeeId },
          data: {
            workEmail: existing.workEmail ?? row.workEmail ?? undefined,
            panNumber: existing.panNumber ?? row.panNumber ?? undefined,
            dateOfBirth: existing.dateOfBirth ?? (row.dateOfBirth ? new Date(row.dateOfBirth) : undefined),
            department: existing.department || row.department || undefined,
            designation: existing.designation || row.designation || undefined,
          },
        });
        updated++;
        if (row.workEmail) idByWorkEmail.set(row.workEmail.toLowerCase(), row.matchedEmployeeId);
        continue;
      }

      // action === "create" (or "update" with no match, which shouldn't
      // happen from the UI but falls back to create rather than silently
      // dropping the row)
      const idNum = row.employeeIdRef && /^\d+$/.test(row.employeeIdRef) ? row.employeeIdRef : null;
      if (!row.fullName || !row.dateOfJoining || !row.department || !row.designation || !idNum) {
        skipped++;
        continue;
      }
      const employee = await createEmployeeRecord({
        // The spreadsheet's own Employee ID, not this app's counter — see
        // the "explicit employeeCode" doc on NewEmployeeInput. Not
        // guaranteed unique against what's already in the database; a
        // collision surfaces as a normal Prisma unique-constraint error,
        // caught by the try/catch around this whole loop.
        employeeCode: `EMP-${idNum.padStart(4, "0")}`,
        fullName: row.fullName,
        workEmail: row.workEmail ?? undefined,
        panNumber: row.panNumber ?? undefined,
        dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : undefined,
        dateOfJoining: new Date(row.dateOfJoining),
        department: row.department,
        designation: row.designation,
        employmentType: "FULL_TIME",
        workMode: "ON_SITE",
        status: "ACTIVE",
        probationEndDate: null, // already-active import, not a new joiner
        seedOnboarding: false, // not actually onboarding — see NewEmployeeInput doc
        changedById: session.user.id,
        statusReason: "Bulk import",
      });
      created++;
      if (row.workEmail) idByWorkEmail.set(row.workEmail.toLowerCase(), employee.id);
    }

    // Second pass: resolve "Manager" references now that every row in this
    // batch has a resolvable id (new or pre-existing).
    for (const row of decisions) {
      if (row.action === "skip" || !row.managerEmail) continue;
      const managerId = idByWorkEmail.get(row.managerEmail.toLowerCase());
      const employeeId =
        row.action === "update" ? row.matchedEmployeeId : idByWorkEmail.get((row.workEmail ?? "").toLowerCase());
      if (!managerId || !employeeId || managerId === employeeId) continue; // no match, or a self-reference placeholder
      await prisma.employee.update({
        where: { id: employeeId },
        data: { reportingManagerId: managerId },
      });
    }
  } catch (err) {
    console.error("confirmImportEmployees failed:", err);
    return { error: "Something went wrong partway through the import. Check /dashboard/employees for what landed." };
  }

  revalidatePath("/dashboard/employees");
  redirect(`/dashboard/employees?imported=${created}&updated=${updated}&skipped=${skipped}`);
}
