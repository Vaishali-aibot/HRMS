import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { findImportSheet, parseImportSheet, type ExistingEmployeeRef } from "./employee-import-parse";

// Builds a workbook shaped like the real "Dotkonnekt" HR register export:
// a leading blank spacer column, a hyperlink-typed email cell for one row
// and a plain-string one for another (the real file mixes both), a
// self-referencing "Manager" (a placeholder some rows use in the real
// data), and a row missing a required field.
function buildWorkbook(rows: unknown[][]) {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet("Dotkonnekt");
  sheet.addRow([
    null,
    "Employee ID",
    "Name",
    "Email",
    "PAN",
    "Title",
    "Department",
    "Manager",
    "Date of Birth",
    "Date of Joining",
  ]);
  for (const row of rows) sheet.addRow(row);
  return wb;
}

const existing: ExistingEmployeeRef[] = [
  { id: "existing-1", employeeCode: "EMP-0004", fullName: "Sophia Jose" },
];

describe("parseImportSheet", () => {
  it("finds the sheet by name, case-insensitively", () => {
    const wb = buildWorkbook([]);
    expect(findImportSheet(wb)?.name).toBe("Dotkonnekt");

    const wb2 = new ExcelJS.Workbook();
    wb2.addWorksheet("DOTKONNEKT ");
    expect(findImportSheet(wb2)?.name).toBe("DOTKONNEKT ");

    const wb3 = new ExcelJS.Workbook();
    wb3.addWorksheet("Some Other Sheet");
    expect(findImportSheet(wb3)).toBeUndefined();
  });

  it("extracts a plain-string email cell and a hyperlink-typed one alike", () => {
    const wb = buildWorkbook([
      [
        null,
        1,
        "Dhiraj Jain",
        { text: "dj@dotkonnekt.com", hyperlink: "mailto:dj@dotkonnekt.com" },
        "ADWPJ1435H",
        "CEO",
        "CEO",
        null,
        new Date("1976-09-04"),
        new Date("2022-01-06"),
      ],
      [
        null,
        6,
        "Pritam Ranjan Padhi",
        "pritam.ranjan@dotkonnekt.com",
        "FNHPP4273D",
        "Team Lead",
        "Engineering",
        "lekha.george@dotkonnekt.com",
        new Date("1999-03-14"),
        new Date("2022-05-01"),
      ],
    ]);
    const sheet = findImportSheet(wb)!;
    const result = parseImportSheet(sheet, []);
    expect(result.error).toBeUndefined();
    expect(result.rows).toHaveLength(2);
    expect(result.rows![0].workEmail).toBe("dj@dotkonnekt.com");
    expect(result.rows![1].workEmail).toBe("pritam.ranjan@dotkonnekt.com");
    expect(result.rows![1].managerEmail).toBe("lekha.george@dotkonnekt.com");
  });

  it("normalizes date cells to UTC midnight, ignoring any time-of-day", () => {
    const wb = buildWorkbook([
      [
        null,
        1,
        "Someone",
        "someone@dotkonnekt.com",
        null,
        "Engineer",
        "Engineering",
        null,
        null,
        new Date("2022-05-01T18:45:00Z"),
      ],
    ]);
    const sheet = findImportSheet(wb)!;
    const result = parseImportSheet(sheet, []);
    expect(result.rows![0].dateOfJoining).toBe("2022-05-01T00:00:00.000Z");
  });

  it("parses a date cell with no date number format applied (a raw Excel serial number)", () => {
    // Seen in the real data: exceljs hands back a plain number, not a
    // Date, for a cell that holds a date but was never formatted as one.
    // 46127 == 2026-04-15 (verified against Excel's day-1900-01-01 epoch).
    const wb = buildWorkbook([
      [null, 1, "Someone", "someone@dotkonnekt.com", null, "Engineer", "Engineering", null, null, 46127],
    ]);
    const sheet = findImportSheet(wb)!;
    const result = parseImportSheet(sheet, []);
    expect(result.rows![0].dateOfJoining).toBe("2026-04-15T00:00:00.000Z");
  });

  it("parses a date typed as plain DD-MM-YYYY text", () => {
    const wb = buildWorkbook([
      [null, 1, "Someone", "someone@dotkonnekt.com", null, "Engineer", "Engineering", null, null, "15-04-2026"],
    ]);
    const sheet = findImportSheet(wb)!;
    const result = parseImportSheet(sheet, []);
    expect(result.rows![0].dateOfJoining).toBe("2026-04-15T00:00:00.000Z");
  });

  it("flags a row missing a required field instead of silently dropping it", () => {
    const wb = buildWorkbook([
      [null, 1, "No Join Date", "x@dotkonnekt.com", null, "Engineer", "Engineering", null, null, null],
      [null, 2, null, "y@dotkonnekt.com", null, "Engineer", "Engineering", null, null, new Date("2022-05-01")],
    ]);
    const sheet = findImportSheet(wb)!;
    const result = parseImportSheet(sheet, []);
    expect(result.rows).toHaveLength(2);
    expect(result.rows![0].errors).toContain("Missing or unparseable date of joining");
    expect(result.rows![1].errors).toContain("Missing name");
  });

  it("flags a row with a missing or non-numeric Employee ID — it becomes the employeeCode", () => {
    const wb = buildWorkbook([
      [null, null, "No ID", "a@dotkonnekt.com", null, "Engineer", "Engineering", null, null, new Date("2022-05-01")],
      [null, "N/A", "Non-numeric ID", "b@dotkonnekt.com", null, "Engineer", "Engineering", null, null, new Date("2022-05-01")],
      [null, 7, "Has A Valid ID", "c@dotkonnekt.com", null, "Engineer", "Engineering", null, null, new Date("2022-05-01")],
    ]);
    const sheet = findImportSheet(wb)!;
    const result = parseImportSheet(sheet, []);
    expect(result.rows![0].errors).toContain("Missing or non-numeric Employee ID");
    expect(result.rows![1].errors).toContain("Missing or non-numeric Employee ID");
    expect(result.rows![2].errors).not.toContain("Missing or non-numeric Employee ID");
  });

  it("flags every row sharing a duplicate Employee ID", () => {
    const wb = buildWorkbook([
      [null, 5, "First", "first@dotkonnekt.com", null, "Engineer", "Engineering", null, null, new Date("2022-05-01")],
      [null, 5, "Second", "second@dotkonnekt.com", null, "Engineer", "Engineering", null, null, new Date("2022-05-01")],
      [null, 6, "Third", "third@dotkonnekt.com", null, "Engineer", "Engineering", null, null, new Date("2022-05-01")],
    ]);
    const sheet = findImportSheet(wb)!;
    const result = parseImportSheet(sheet, []);
    expect(result.rows![0].errors.some((e) => e.includes("more than once"))).toBe(true);
    expect(result.rows![1].errors.some((e) => e.includes("more than once"))).toBe(true);
    expect(result.rows![2].errors.some((e) => e.includes("more than once"))).toBe(false);
  });

  it("matches an existing employee by name, case-insensitively/trimmed", () => {
    const wb = buildWorkbook([
      [
        null,
        15,
        "  sophia jose  ",
        "sophia.jose@dotkonnekt.com",
        "ASXPJ1819R",
        "Product Leader",
        "Product",
        null,
        new Date("1978-02-06"),
        new Date("2022-09-10"),
      ],
    ]);
    const sheet = findImportSheet(wb)!;
    const result = parseImportSheet(sheet, existing);
    expect(result.rows![0].matchedEmployeeId).toBe("existing-1");
    expect(result.rows![0].matchedEmployeeCode).toBe("EMP-0004");
  });

  it("does not match an unrelated name", () => {
    const wb = buildWorkbook([
      [null, 1, "Nobody Existing", "nobody@dotkonnekt.com", null, "Engineer", "Engineering", null, null, new Date("2022-05-01")],
    ]);
    const sheet = findImportSheet(wb)!;
    const result = parseImportSheet(sheet, existing);
    expect(result.rows![0].matchedEmployeeId).toBeNull();
  });

  it("skips a fully blank row rather than producing an all-null entry", () => {
    const wb = buildWorkbook([
      [null, 1, "Real Person", "real@dotkonnekt.com", null, "Engineer", "Engineering", null, null, new Date("2022-05-01")],
      [],
    ]);
    const sheet = findImportSheet(wb)!;
    const result = parseImportSheet(sheet, []);
    expect(result.rows).toHaveLength(1);
  });

  it("errors clearly when a required column header is missing", () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet("Dotkonnekt");
    sheet.addRow([null, "Name", "Email"]); // no Department/Title/Date of Joining
    sheet.addRow([null, "Someone", "someone@dotkonnekt.com"]);
    const result = parseImportSheet(sheet, []);
    expect(result.error).toMatch(/Missing expected column/);
  });
});
