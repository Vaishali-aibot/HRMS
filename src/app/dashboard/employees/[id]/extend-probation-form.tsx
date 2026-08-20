"use client";

import { useActionState } from "react";

import { extendProbation, type ExtendProbationState } from "@/lib/actions/employee-detail";

const initialState: ExtendProbationState = {};

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

export function ExtendProbationForm({
  employeeId,
  currentEndDate,
}: {
  employeeId: string;
  currentEndDate: string;
}) {
  const [state, formAction, pending] = useActionState(extendProbation, initialState);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="text-sm font-semibold">Extend probation</h2>
      <p className="mt-1 text-xs text-black/50 dark:text-white/50">
        Current end date: {currentEndDate}
      </p>
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">New end date</span>
          <input type="date" name="newProbationEndDate" required className={inputClass} />
        </label>
        <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Reason</span>
          <input name="reason" required className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Saving…" : "Extend"}
        </button>
      </div>
      {state.error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
