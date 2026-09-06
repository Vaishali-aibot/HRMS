"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import {
  cancelLeaveRequest,
  decideLeaveRequest,
  type LeaveActionState,
} from "@/lib/actions/leave";

const initialState: LeaveActionState = {};

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
    <li className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {showEmployeeName && <span className="font-medium">{request.employeeName} · </span>}
          <span className="font-medium">{request.leaveTypeName}</span>: {request.startDate} →{" "}
          {request.endDate} ({request.days} day{request.days === 1 ? "" : "s"})
        </div>
        <StatusBadge status={request.status} />
      </div>
      {request.reason && <p className="mt-1 text-muted-foreground">{request.reason}</p>}

      {canCancel && isPending && (
        <form action={cancelAction} className="mt-2">
          <input type="hidden" name="requestId" value={request.id} />
          <Button type="submit" variant="outline" size="xs" disabled={cancelPending}>
            {cancelPending ? "Cancelling…" : "Cancel"}
          </Button>
        </form>
      )}
      {cancelState.error && <p className="mt-1 text-xs text-destructive">{cancelState.error}</p>}

      {canDecide && isPending && (
        <div className="mt-2 flex gap-2">
          <form action={approveAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="decision" value="APPROVED" />
            <Button type="submit" variant="outline" size="xs" disabled={approvePending}>
              {approvePending ? "…" : "Approve"}
            </Button>
          </form>
          <form action={rejectAction}>
            <input type="hidden" name="requestId" value={request.id} />
            <input type="hidden" name="decision" value="REJECTED" />
            <Button type="submit" variant="outline" size="xs" disabled={rejectPending}>
              {rejectPending ? "…" : "Reject"}
            </Button>
          </form>
        </div>
      )}
      {(approveState.error || rejectState.error) && (
        <p className="mt-1 text-xs text-destructive">
          {approveState.error || rejectState.error}
        </p>
      )}
    </li>
  );
}
