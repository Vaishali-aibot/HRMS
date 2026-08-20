"use client";

import { useActionState } from "react";

import { createLeaveType, type LeaveTypeState } from "@/lib/actions/leave-type";

const initialState: LeaveTypeState = {};

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

export function AddLeaveTypeForm() {
  const [state, formAction, pending] = useActionState(createLeaveType, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Name</span>
        <input name="name" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Annual days</span>
        <input type="number" name="annualDays" min={0} step="0.5" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Carry-forward limit</span>
        <input
          type="number"
          name="carryForwardLimit"
          min={0}
          step="0.5"
          placeholder="0"
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Accrual</span>
        <select name="accrualMethod" defaultValue="ANNUAL" className={inputClass}>
          <option value="ANNUAL">Annual (all at once)</option>
          <option value="MONTHLY">Monthly (1/12 per month)</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Adding…" : "Add leave type"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
