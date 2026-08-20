"use client";

import { useActionState } from "react";

import { initiateExit, type InitiateExitState } from "@/lib/actions/exit";

const initialState: InitiateExitState = {};

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

export function InitiateExitForm({ employeeId }: { employeeId: string }) {
  const [state, formAction, pending] = useActionState(initiateExit, initialState);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="text-sm font-semibold">Record resignation</h2>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
        Moves status to Notice Period and creates the exit checklist (PRD §24).
      </p>
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Resignation date</span>
          <input type="date" name="resignationDate" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Notice period (days)</span>
          <input
            type="number"
            name="noticePeriodDays"
            min={0}
            required
            defaultValue={30}
            className={inputClass}
          />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Reason (optional)</span>
          <input name="reason" className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Saving…" : "Start exit process"}
        </button>
      </div>
      {state.error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
