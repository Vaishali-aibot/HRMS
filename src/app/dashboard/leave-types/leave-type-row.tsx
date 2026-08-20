"use client";

import { useActionState } from "react";

import { updateLeaveType, type LeaveTypeState } from "@/lib/actions/leave-type";

const initialState: LeaveTypeState = {};

const inputClass =
  "w-20 rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

export function LeaveTypeRow({
  leaveType,
}: {
  leaveType: {
    id: string;
    name: string;
    annualDays: number;
    carryForwardLimit: number;
    isActive: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(updateLeaveType, initialState);

  return (
    <tr className="border-t border-black/10 dark:border-white/10">
      <td className="px-4 py-2">{leaveType.name}</td>
      <td className="px-4 py-2">
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="leaveTypeId" value={leaveType.id} />
          <label className="flex items-center gap-1 text-xs">
            Days
            <input
              type="number"
              name="annualDays"
              min={0}
              step="0.5"
              defaultValue={leaveType.annualDays}
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            Carry-forward
            <input
              type="number"
              name="carryForwardLimit"
              min={0}
              step="0.5"
              defaultValue={leaveType.carryForwardLimit}
              title="Max days carried into next year"
              className={inputClass}
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            {/* No hidden "false" fallback needed — an unchecked checkbox
                is simply absent from FormData, and the action treats a
                missing value as false. */}
            <input type="checkbox" name="isActive" value="true" defaultChecked={leaveType.isActive} />
            Active
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
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
