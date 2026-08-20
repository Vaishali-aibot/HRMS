"use client";

import { useActionState } from "react";

import { changeEmployeeStatus, type ChangeStatusState } from "@/lib/actions/employee-detail";

const initialState: ChangeStatusState = {};

const STATUSES = [
  "CANDIDATE",
  "OFFER_ACCEPTED",
  "PRE_BOARDING",
  "ONBOARDING",
  "PROBATION",
  "CONFIRMED",
  "ACTIVE",
  "NOTICE_PERIOD",
  "EXITED",
  "ALUMNI",
] as const;

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

export function StatusChangeForm({
  employeeId,
  currentStatus,
}: {
  employeeId: string;
  currentStatus: string;
}) {
  const [state, formAction, pending] = useActionState(changeEmployeeStatus, initialState);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="text-sm font-semibold">Lifecycle status</h2>
      <input type="hidden" name="employeeId" value={employeeId} />

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">New status</span>
          <select name="newStatus" defaultValue={currentStatus} className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">Reason (optional)</span>
          <input name="reason" className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Updating…" : "Update status"}
        </button>
      </div>

      {state.error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
