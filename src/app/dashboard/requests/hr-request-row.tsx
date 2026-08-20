"use client";

import { useActionState } from "react";

import {
  cancelHRRequest,
  updateHRRequestStatus,
  type HRRequestActionState,
} from "@/lib/actions/hr-request";

const initialState: HRRequestActionState = {};

const STATUSES = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20";
const buttonClass =
  "rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10";

// Not a configurable SLA policy — just a visible "this has been open a
// while" cue, per the schema comment on HRRequest. Exported so the
// server-rendering page can apply the same threshold when it computes
// daysOpen (a "now" calculation belongs in the Server Component, not here
// — computing Date.now() during a component's render is impure and React
// flags it).
export const HR_REQUEST_OVERDUE_DAYS = 3;

export function HRRequestRow({
  request,
  showEmployeeName = false,
  canCancel = false,
  canManage = false,
}: {
  request: {
    id: string;
    employeeName?: string;
    category: string;
    subject: string;
    description: string;
    status: string;
    resolutionNote: string | null;
    daysOpen: number;
  };
  showEmployeeName?: boolean;
  canCancel?: boolean;
  canManage?: boolean;
}) {
  const [manageState, manageAction, managePending] = useActionState(
    updateHRRequestStatus,
    initialState
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelHRRequest,
    initialState
  );

  const { daysOpen } = request;
  const isOpen = request.status !== "CLOSED" && request.status !== "RESOLVED";
  const overdue = isOpen && daysOpen >= HR_REQUEST_OVERDUE_DAYS;

  return (
    <li
      className={`rounded-md border p-3 text-sm ${
        overdue
          ? "border-amber-400/60 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-950/20"
          : "border-black/10 dark:border-white/15"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {showEmployeeName && <span className="font-medium">{request.employeeName} · </span>}
          <span className="font-medium">{request.subject}</span>{" "}
          <span className="text-black/50 dark:text-white/50">
            ({request.category.replaceAll("_", " ")})
          </span>
        </div>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {request.status}
        </span>
      </div>
      <p className="mt-1 text-black/60 dark:text-white/60">{request.description}</p>
      {request.resolutionNote && (
        <p className="mt-1 text-black/60 dark:text-white/60">
          <span className="font-medium">Resolution:</span> {request.resolutionNote}
        </p>
      )}
      <p className="mt-1 text-xs text-black/40 dark:text-white/40">
        Open {daysOpen} day{daysOpen === 1 ? "" : "s"}
        {overdue && " — overdue"}
      </p>

      {canCancel && request.status !== "CLOSED" && (
        <form action={cancelAction} className="mt-2">
          <input type="hidden" name="requestId" value={request.id} />
          <button type="submit" disabled={cancelPending} className={buttonClass}>
            {cancelPending ? "Cancelling…" : "Withdraw"}
          </button>
        </form>
      )}
      {cancelState.error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{cancelState.error}</p>
      )}

      {canManage && (
        <form action={manageAction} className="mt-2 flex flex-wrap items-end gap-2">
          <input type="hidden" name="requestId" value={request.id} />
          <select name="status" defaultValue={request.status} className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            name="resolutionNote"
            placeholder="Resolution note (optional)"
            defaultValue={request.resolutionNote ?? ""}
            className={`${inputClass} flex-1 min-w-[10rem]`}
          />
          <button type="submit" disabled={managePending} className={buttonClass}>
            {managePending ? "Saving…" : "Save"}
          </button>
        </form>
      )}
      {manageState.error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{manageState.error}</p>
      )}
    </li>
  );
}
