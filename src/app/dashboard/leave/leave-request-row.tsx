"use client";

import { useActionState } from "react";

import {
  cancelLeaveRequest,
  decideLeaveRequest,
  type LeaveActionState,
} from "@/lib/actions/leave";

const initialState: LeaveActionState = {};

const buttonClass =
  "rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10";

export function LeaveRequestRow({
  request,
  showEmployeeName = false,
  canCancel = false,
  canDecide = false,
}: {
  request: {
    id: string;
    employeeName?: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    days: number;
    reason: string | null;
    status: string;
  };
  showEmployeeName?: boolean;
  canCancel?: boolean;
  canDecide?: boolean;
}) {
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelLeaveRequest,
    initialState
  );
  const [approveState, approveAction, approvePending] = useActionState(
    decideLeaveRequest,
    initialState
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    decideLeaveRequest,
    initialState
  );

  const isPending = request.status === "PENDING";

  return (
    <li className="rounded-md border border-black/10 p-3 text-sm dark:border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {showEmployeeName && <span className="font-medium">{request.employeeName} · </span>}
          {request.leaveTypeName}: {request.startDate} → {request.endDate} ({request.days} day
          {request.days === 1 ? "" : "s"})
        </div>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {request.status}
        </span>
      </div>
      {request.reason && (
        <div className="mt-1 text-black/60 dark:text-white/60">{request.reason}</div>
      )}

      {canCancel && isPending && (
        <form action={cancelAction} className="mt-2">
          <input type="hidden" name="requestId" value={request.id} />
          <button type="submit" disabled={cancelPending} className={buttonClass}>
            {cancelPending ? "Cancelling…" : "Cancel"}
          </button>
        </form>
      )}
      {cancelState.error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{cancelState.error}</p>
      )}

      {canDecide && isPending && (
        <div className="mt-2 flex gap-2">
          <form action={approveAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="decision" value="APPROVED" />
            <button type="submit" disabled={approvePending} className={buttonClass}>
              {approvePending ? "…" : "Approve"}
            </button>
          </form>
          <form action={rejectAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="decision" value="REJECTED" />
            <button type="submit" disabled={rejectPending} className={buttonClass}>
              {rejectPending ? "…" : "Reject"}
            </button>
          </form>
        </div>
      )}
      {(approveState.error || rejectState.error) && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {approveState.error || rejectState.error}
        </p>
      )}
    </li>
  );
}
