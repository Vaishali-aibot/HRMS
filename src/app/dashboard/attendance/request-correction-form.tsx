"use client";

import { useActionState } from "react";

import {
  requestAttendanceCorrection,
  type CorrectionActionState,
} from "@/lib/actions/attendance-correction";

const initialState: CorrectionActionState = {};

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
  "rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

export function RequestCorrectionForm() {
  const [state, formAction, pending] = useActionState(
    requestAttendanceCorrection,
    initialState
  );

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Date</span>
        <input type="date" name="date" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Should be</span>
        <select name="requestedStatus" className={inputClass}>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Reason</span>
        <input name="reason" required className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Submitting…" : "Request correction"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
