"use client";

import { useActionState } from "react";

import { addGoal, type GoalActionState } from "@/lib/actions/goal";

const initialState: GoalActionState = {};

const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

export function AddGoalForm({ employeeId, cycleId }: { employeeId: string; cycleId: string }) {
  const [state, formAction, pending] = useActionState(addGoal, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_auto]">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="cycleId" value={cycleId} />
      <input name="title" placeholder="Goal title" required className={inputClass} />
      <input
        type="number"
        name="weight"
        min={0}
        max={100}
        placeholder="Weight % (optional)"
        className={inputClass}
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
      >
        {pending ? "Adding…" : "Add goal"}
      </button>
      <textarea
        name="description"
        placeholder="Description (optional)"
        className={`${inputClass} sm:col-span-3`}
        rows={2}
      />
      {state.error && (
        <p className="text-xs text-red-600 sm:col-span-3 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
