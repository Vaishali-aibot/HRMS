"use client";

import { useActionState } from "react";

import {
  cancelLeaveEncashment,
  decideLeaveEncashment,
  type LeaveEncashmentState,
} from "@/lib/actions/leave-encashment";

const initialState: LeaveEncashmentState = {};

const buttonClass =
  "rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10";

export function EncashmentRequestRow({
  request,
  showEmployeeName = false,
  canCancel = false,
  canDecide = false,
}: {
  request: {
    id: string;
    employeeName?: string;
    leaveTypeName: string;
    year: number;
    days: number;
    status: string;
  };
  showEmployeeName?: boolean;
  canCancel?: boolean;
  canDecide?: boolean;
}) {
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelLeaveEncashment,
    initialState
  );
  const [approveState, approveAction, approvePending] = useActionState(
    decideLeaveEncashment,
    initialState
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    decideLeaveEncashment,
    initialState
  );

  const isPending = request.status === "PENDING";

  return (
    <li className="rounded-md border border-black/10 p-3 text-sm dark:border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {showEmployeeName && <span className="font-medium">{request.employeeName} · </span>}
          {request.leaveTypeName}: {request.days} day{request.days === 1 ? "" : "s"} ({request.year})
        </div>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {request.status}
        </span>
      </div>

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
