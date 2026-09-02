"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { TableCell, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { markAttendance, type MarkAttendanceState } from "@/lib/actions/attendance";

const initialState: MarkAttendanceState = {};

const STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "WORK_FROM_HOME",
  "HOLIDAY",
  "ON_LEAVE",
  "MISSING",
] as const;

export function AttendanceRow({
  employee,
  date,
  currentStatus,
  editable,
}: {
  employee: { id: string; employeeCode: string; fullName: string };
  date: string;
  currentStatus: string | null;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(markAttendance, initialState);

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{employee.employeeCode}</TableCell>
      <TableCell className="font-medium">{employee.fullName}</TableCell>
      <TableCell>
        {editable ? (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="employeeId" value={employee.id} />
            <input type="hidden" name="date" value={date} />
            <NativeSelect
              name="status"
              defaultValue={currentStatus ?? "MISSING"}
              className="h-7 w-36 text-xs"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" variant="outline" size="xs" disabled={pending}>
              {pending ? "…" : "Save"}
            </Button>
          </form>
        ) : (
          <StatusBadge status={currentStatus ?? "MISSING"} />
        )}
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      </TableCell>
    </TableRow>
  );
}
