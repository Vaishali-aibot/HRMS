"use client";

import { useActionState } from "react";

import { createPerformanceCycle, type PerformanceCycleState } from "@/lib/actions/performance-cycle";

const initialState: PerformanceCycleState = {};

const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

export function CreateCycleForm() {
  const [state, formAction, pending] = useActionState(createPerformanceCycle, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm">
        Name
        <input name="name" placeholder="e.g. H1 2026" required className={inputClass} />
      </label>
      <div />
      <label className="text-sm">
        Start date
        <input type="date" name="startDate" required className={inputClass} />
      </label>
      <label className="text-sm">
        End date
        <input type="date" name="endDate" required className={inputClass} />
      </label>
      <label className="text-sm">
        Self-review due (optional)
        <input type="date" name="selfReviewDueDate" className={inputClass} />
      </label>
      <label className="text-sm">
        Manager-review due (optional)
        <input type="date" name="managerReviewDueDate" className={inputClass} />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Creating…" : "Create cycle"}
        </button>
      </div>
      {state.error && (
        <p className="text-xs text-red-600 sm:col-span-2 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
