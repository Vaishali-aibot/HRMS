"use client";

import { useActionState } from "react";

import { requestLeaveEncashment, type LeaveEncashmentState } from "@/lib/actions/leave-encashment";

const initialState: LeaveEncashmentState = {};

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

export function RequestEncashmentForm({
  leaveTypes,
}: {
  leaveTypes: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(requestLeaveEncashment, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Leave type
        <select name="leaveTypeId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select…
          </option>
          {leaveTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Days
        <input type="number" name="days" min={0.5} step="0.5" required className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
      >
        {pending ? "Requesting…" : "Request encashment"}
      </button>
      {state.error && <p className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
