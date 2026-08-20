"use client";

import { useActionState } from "react";

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

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20";

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
    <tr className="border-t border-black/10 dark:border-white/10">
      <td className="px-4 py-2 font-mono text-xs">{employee.employeeCode}</td>
      <td className="px-4 py-2">{employee.fullName}</td>
      <td className="px-4 py-2">
        {editable ? (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="employeeId" value={employee.id} />
            <input type="hidden" name="date" value={date} />
            <select name="status" defaultValue={currentStatus ?? "MISSING"} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              {pending ? "…" : "Save"}
            </button>
          </form>
        ) : (
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
            {(currentStatus ?? "MISSING").replaceAll("_", " ")}
          </span>
        )}
        {state.error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
        )}
      </td>
    </tr>
  );
}
