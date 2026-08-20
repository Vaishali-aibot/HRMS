"use client";

import { useActionState } from "react";

import { submitResignationRequest, type ResignationActionState } from "@/lib/actions/resignation";

const initialState: ResignationActionState = {};

const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

export function ResignForm() {
  const [state, formAction, pending] = useActionState(submitResignationRequest, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm">
        Resignation date
        <input type="date" name="resignationDate" required className={inputClass} />
      </label>
      <label className="text-sm">
        Notice period (days)
        <input
          type="number"
          name="noticePeriodDays"
          min={0}
          defaultValue={30}
          required
          className={inputClass}
        />
      </label>
      <label className="text-sm sm:col-span-2">
        Reason (optional)
        <textarea name="reason" rows={2} className={inputClass} />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Submitting…" : "Submit resignation"}
        </button>
      </div>
      {state.error && (
        <p className="text-xs text-red-600 sm:col-span-2 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
