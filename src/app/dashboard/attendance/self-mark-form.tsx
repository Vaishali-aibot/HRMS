"use client";

import { useActionState } from "react";

import { markOwnAttendanceToday, type MarkAttendanceState } from "@/lib/actions/attendance";

const initialState: MarkAttendanceState = {};

const STATUSES = ["PRESENT", "WORK_FROM_HOME", "HALF_DAY"] as const;

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

export function SelfMarkForm() {
  const [state, formAction, pending] = useActionState(markOwnAttendanceToday, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <select name="status" defaultValue="PRESENT" className={inputClass}>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Check in for today"}
      </button>
      {state.error && (
        <p className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
