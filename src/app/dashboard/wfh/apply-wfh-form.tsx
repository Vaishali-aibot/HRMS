"use client";

import { useActionState } from "react";

import { requestWFH, type WFHActionState } from "@/lib/actions/wfh";

const initialState: WFHActionState = {};

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

export function ApplyWFHForm() {
  const [state, formAction, pending] = useActionState(requestWFH, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Start date</span>
        <input type="date" name="startDate" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">End date</span>
        <input type="date" name="endDate" required className={inputClass} />
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
        {pending ? "Submitting…" : "Request WFH"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
