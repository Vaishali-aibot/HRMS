import ExcelJS from "exceljs";

export const IMPORT_SHEET_NAME = "Dotkonnekt";

// Header text this looks for in the sheet's first row — matched
// case-insensitively/trimmed, not by fixed column position, so a
// re-ordered or re-exported version of the same spreadsheet still works.
const HEADER_ALIASES = {
  employeeIdRef: ["employee id"],
  fullName: ["name"],
  workEmail: ["email"],
  panNumber: ["pan"],
  designation: ["title"],
  department: ["department"],
  managerEmail: ["manager"],
  dateOfBirth: ["date of birth"],
  dateOfJoining: ["date of joining"],
} as const;

type Field = keyof typeof HEADER_ALIASES;
const REQUIRED_FIELDS: Field[] = [
  "employeeIdRef",
  "fullName",
  "dateOfJoining",
  "department",
  "designation",
];

export type ParsedEmployeeRow = {
  // Stable key for this row within one preview/confirm round-trip — not
  // persisted anywhere.
  key: string;
  rowNumber: number;
  employeeIdRef: string | null; // their spreadsheet's own numbering, display-only
  fullName: string | null;
  workEmail: string | null;
  panNumber: string | null;
  designation: string | null;
  department: string | null;
  managerEmail: string | null;
  dateOfBirth: string | null; // ISO date, date-only
  dateOfJoining: string | null; // ISO date, date-only
  errors: string[]; // non-empty means this row can't be imported as-is
  // Populated by matching fullName (case-insensitive/trimmed) against
  // existing employees — see the README-documented caveat that there's no
  // reliable stronger identifier to match on for pre-existing records.
  matchedEmployeeId: string | null;
  matchedEmployeeCode: string | null;
  matchedFullName: string | null;
};

export type ParseResult = { error: string; rows?: undefined } | { error?: undefined; rows: ParsedEmployeeRow[] };

export type ExistingEmployeeRef = { id: string; employeeCode: string; fullName: string };

function cellText(cell: ExcelJS.CellValue): string | null {
  if (cell == null) return null;
  if (typeof cell === "string") {
    const trimmed = cell.trim();
    return trimmed || null;
  }
  if (typeof cell === "number") return String(cell);
  if (cell instanceof Date) return cell.toISOString();
  // Hyperlink cells (e.g. a mailto: link) come back as { text, hyperlink }.
  if (typeof cell === "object" && "text" in cell) {
    const text = String((cell as { text: unknown }).text ?? "").trim();
    if (text) return text;
    const link = (cell as { hyperlink?: string }).hyperlink;
    if (link?.startsWith("mailto:")) return link.slice("mailto:".length).trim();
    return null;
  }
  return null;
}

function cellDateOnly(cell: ExcelJS.CellValue): string | null {
  if (cell instanceof Date) {
    // Normalize to UTC midnight, matching the app's DATE_ONLY convention —
    // the spreadsheet's date cells have no meaningful time-of-day.
    return new Date(
      Date.UTC(cell.getUTCFullYear(), cell.getUTCMonth(), cell.getUTCDate())
    ).toISOString();
  }
  // A date cell without a date number format applied (seen in the real
  // data — exceljs then hands back the raw Excel serial number instead of
  // a Date) — day 1 is 1900-01-01, with Excel's well-known day-60 leap-year
  // bug baked into the epoch offset below, same as every spreadsheet tool
  // reproduces it.
  if (typeof cell === "number" && Number.isFinite(cell) && cell > 0) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + cell * 86400000).toISOString();
  }
  // A date typed as plain text (also seen in the real data) rather than a
  // real date cell — DD-MM-YYYY only, since that's the format observed;
  // anything else is left unparsed rather than guessed at.
  if (typeof cell === "string") {
    const match = cell.trim().match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (match) {
      const [, day, month, year] = match;
      return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toISOString();
    }
  }
  return null;
}

/** Finds the "Dotkonnekt" sheet by name (case-insensitive). */
export function findImportSheet(workbook: ExcelJS.Workbook): ExcelJS.Worksheet | undefined {
  return workbook.worksheets.find(
    (s) => s.name.trim().toLowerCase() === IMPORT_SHEET_NAME.toLowerCase()
  );
}

/**
 * Pure parsing: given one worksheet and the current employee roster (for
 * the name-based duplicate match), returns every data row as a
 * ParsedEmployeeRow, or an error if the sheet's headers don't look like
 * what this importer expects. No I/O, no auth — kept separate from the
 * Server Action in src/lib/actions/employee-import.ts so it's testable on
 * its own and reviewable independent of the request-handling wrapper.
 */
export function parseImportSheet(
  sheet: ExcelJS.Worksheet,
  existingEmployees: ExistingEmployeeRef[]
): ParseResult {
  const columnByField: Partial<Record<Field, number>> = {};
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const text = cellText(cell.value)?.toLowerCase();
    if (!text) return;
    for (const [field, aliases] of Object.entries(HEADER_ALIASES) as [Field, readonly string[]][]) {
      if ((aliases as readonly string[]).includes(text)) {
        columnByField[field] = colNumber;
      }
    }
  });

  const missingRequired = REQUIRED_FIELDS.filter((f) => !(f in columnByField));
  if (missingRequired.length > 0) {
    return {
      error: `Missing expected column(s) in "${IMPORT_SHEET_NAME}": ${missingRequired
        .map((f) => HEADER_ALIASES[f][0])
        .join(", ")}.`,
    };
  }

  const at = (row: ExcelJS.Row, field: Field) => {
    const col = columnByField[field];
    return col ? row.getCell(col).value : null;
  };

  const existingByName = new Map(
    existingEmployees.map((e) => [e.fullName.trim().toLowerCase(), e])
  );

  const rows: ParsedEmployeeRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    if (row.actualCellCount === 0) continue; // fully blank row — skip silently

    const fullName = cellText(at(row, "fullName"));
    const workEmail = cellText(at(row, "workEmail"));
    const panNumber = cellText(at(row, "panNumber"));
    const designation = cellText(at(row, "designation"));
    const department = cellText(at(row, "department"));
    const managerEmail = cellText(at(row, "managerEmail"));
    const dateOfBirth = cellDateOnly(at(row, "dateOfBirth"));
    const dateOfJoining = cellDateOnly(at(row, "dateOfJoining"));
    const employeeIdRef = cellText(at(row, "employeeIdRef"));

    const errors: string[] = [];
    if (!fullName) errors.push("Missing name");
    if (!dateOfJoining) errors.push("Missing or unparseable date of joining");
    if (!department) errors.push("Missing department");
    if (!designation) errors.push("Missing title/designation");
    // Used directly as the new record's employeeCode (EMP-XXXX) — the
    // spreadsheet's own numbering, not this app's counter — so it has to
    // be a real positive integer.
    if (!employeeIdRef || !/^\d+$/.test(employeeIdRef)) {
      errors.push("Missing or non-numeric Employee ID");
    }

    const match = fullName ? existingByName.get(fullName.trim().toLowerCase()) : undefined;

    rows.push({
      key: `row-${r}`,
      rowNumber: r,
      employeeIdRef,
      fullName,
      workEmail,
      panNumber,
      designation,
      department,
      managerEmail,
      dateOfBirth,
      dateOfJoining,
      errors,
      matchedEmployeeId: match?.id ?? null,
      matchedEmployeeCode: match?.employeeCode ?? null,
      matchedFullName: match?.fullName ?? null,
    });
  }

  if (rows.length === 0) {
    return { error: `"${IMPORT_SHEET_NAME}" has no data rows.` };
  }

  // A duplicate Employee ID in the sheet would collide as employeeCode
  // (unique) — flag every row it appears on rather than silently letting
  // whichever one is processed first win.
  const idCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.employeeIdRef) idCounts.set(row.employeeIdRef, (idCounts.get(row.employeeIdRef) ?? 0) + 1);
  }
  for (const row of rows) {
    if (row.employeeIdRef && (idCounts.get(row.employeeIdRef) ?? 0) > 1) {
      row.errors.push(`Employee ID ${row.employeeIdRef} appears more than once in the sheet`);
    }
  }

  return { rows };
}
