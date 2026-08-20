"use client";

import { useActionState } from "react";

import {
  updatePerformanceCycleStatus,
  type PerformanceCycleState,
} from "@/lib/actions/performance-cycle";

const initialState: PerformanceCycleState = {};

export function CycleRow({
  cycle,
}: {
  cycle: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updatePerformanceCycleStatus, initialState);

  return (
    <tr className="border-t border-black/10 dark:border-white/10">
      <td className="px-4 py-2 font-medium">{cycle.name}</td>
      <td className="px-4 py-2 text-black/60 dark:text-white/60">
        {cycle.startDate} → {cycle.endDate}
      </td>
      <td className="px-4 py-2">
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="cycleId" value={cycle.id} />
          <select
            name="status"
            defaultValue={cycle.status}
            className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
          >
            <option value="DRAFT">DRAFT</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="CLOSED">CLOSED</option>
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
        {state.error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
        )}
      </td>
    </tr>
  );
}
