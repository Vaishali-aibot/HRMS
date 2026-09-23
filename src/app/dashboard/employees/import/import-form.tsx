"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  confirmImportEmployees,
  previewImportEmployees,
  type ConfirmImportState,
  type ParsedEmployeeRow,
  type PreviewImportState,
} from "@/lib/actions/employee-import";

type RowAction = "create" | "update" | "skip";

function defaultActionFor(row: ParsedEmployeeRow): RowAction {
  if (row.matchedEmployeeId) return "skip"; // safest default — see the import page's copy
  if (row.errors.length > 0) return "skip"; // can't create without the required fields
  return "create";
}

function fmt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { timeZone: "UTC" });
}

const previewInitial: PreviewImportState = {};
const confirmInitial: ConfirmImportState = {};

export function ImportEmployeesForm() {
  const [previewState, previewAction, previewPending] = useActionState(
    previewImportEmployees,
    previewInitial
  );
  const [confirmState, confirmAction, confirmPending] = useActionState(
    confirmImportEmployees,
    confirmInitial
  );

  const [rows, setRows] = useState<ParsedEmployeeRow[]>([]);
  const [actions, setActions] = useState<Record<string, RowAction>>({});

  // Seed local editable state once a preview succeeds. previewState.rows is
  // a fresh array identity on every successful submission, so this only
  // re-runs when a new preview actually comes back.
  useEffect(() => {
    if (previewState.rows) {
      setRows(previewState.rows);
      setActions(
        Object.fromEntries(previewState.rows.map((r) => [r.key, defaultActionFor(r)]))
      );
    }
  }, [previewState.rows]);

  const counts = useMemo(() => {
    const c = { create: 0, update: 0, skip: 0 };
    for (const row of rows) c[actions[row.key] ?? "skip"]++;
    return c;
  }, [rows, actions]);

  const payload = useMemo(
    () =>
      JSON.stringify(
        rows.map((r) => ({
          key: r.key,
          action: actions[r.key] ?? "skip",
          fullName: r.fullName,
          workEmail: r.workEmail,
          panNumber: r.panNumber,
          designation: r.designation,
          department: r.department,
          managerEmail: r.managerEmail,
          dateOfBirth: r.dateOfBirth,
          dateOfJoining: r.dateOfJoining,
          matchedEmployeeId: r.matchedEmployeeId,
        }))
      ),
    [rows, actions]
  );

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Upload</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={previewAction} className="flex items-center gap-2">
            <input
              type="file"
              name="file"
              accept=".xlsx"
              required
              className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <Button type="submit" disabled={previewPending}>
              {previewPending ? "Reading…" : "Preview import"}
            </Button>
          </form>
          {previewState.error && (
            <p className="mt-2 text-sm text-destructive">{previewState.error}</p>
          )}
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Review</CardTitle>
            <CardDescription>
              {counts.create} to create · {counts.update} to update · {counts.skip} to skip.
              Rows that already match an existing employee (by name) default to{" "}
              <span className="font-medium text-foreground">Skip</span> — switch to{" "}
              <span className="font-medium text-foreground">Update existing</span> to backfill
              any fields that record is currently missing.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Row</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                      <TableCell className="font-medium">{row.fullName ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.workEmail ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.designation ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.department ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {fmt(row.dateOfJoining)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.errors.length > 0 ? (
                          <span className="text-destructive">{row.errors.join(", ")}</span>
                        ) : row.matchedEmployeeId ? (
                          `${row.matchedEmployeeCode} — ${row.matchedFullName}`
                        ) : (
                          "New"
                        )}
                      </TableCell>
                      <TableCell>
                        <NativeSelect
                          value={actions[row.key] ?? "skip"}
                          onChange={(e) =>
                            setActions((prev) => ({
                              ...prev,
                              [row.key]: e.target.value as RowAction,
                            }))
                          }
                          className="h-7 w-36 text-xs"
                        >
                          <option value="skip">Skip</option>
                          {row.errors.length === 0 && <option value="create">Create new</option>}
                          {row.matchedEmployeeId && (
                            <option value="update">Update existing</option>
                          )}
                        </NativeSelect>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <form action={confirmAction} className="flex items-center gap-3 px-4">
              <input type="hidden" name="rows" value={payload} />
              <Button type="submit" disabled={confirmPending}>
                {confirmPending
                  ? "Importing…"
                  : `Confirm import (${counts.create + counts.update} row${
                      counts.create + counts.update === 1 ? "" : "s"
                    })`}
              </Button>
              {confirmState.error && (
                <p className="text-sm text-destructive">{confirmState.error}</p>
              )}
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
