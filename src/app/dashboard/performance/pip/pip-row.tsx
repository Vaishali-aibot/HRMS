"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/status-badge";
import { addPIPCheckIn, closePIP, type PIPActionState } from "@/lib/actions/pip";

const initialState: PIPActionState = {};

export function PIPRow({
  pip,
  canManage,
}: {
  pip: {
    id: string;
    employeeName?: string;
    reason: string;
    goals: string;
    startDate: string;
    endDate: string;
    status: string;
    outcomeNotes: string | null;
    checkIns: { id: string; note: string; createdAt: string }[];
  };
  canManage: boolean;
}) {
  const [checkInState, checkInAction, checkInPending] = useActionState(
    addPIPCheckIn,
    initialState
  );
  const [closeState, closeAction, closePending] = useActionState(closePIP, initialState);

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-medium">
            {pip.employeeName && <span>{pip.employeeName} · </span>}
            <span className="text-muted-foreground">
              {pip.startDate} → {pip.endDate}
            </span>
          </div>
          <StatusBadge status={pip.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Reason:</span> {pip.reason}
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Goals:</span> {pip.goals}
        </p>
        {pip.outcomeNotes && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Outcome:</span> {pip.outcomeNotes}
          </p>
        )}

        <div>
          <p className="text-xs font-medium text-muted-foreground">Check-ins</p>
          <ul className="mt-1 flex flex-col gap-1">
            {pip.checkIns.map((c) => (
              <li key={c.id} className="text-xs text-muted-foreground">
                {c.createdAt}: {c.note}
              </li>
            ))}
            {pip.checkIns.length === 0 && (
              <li className="text-xs text-muted-foreground/70">None yet.</li>
            )}
          </ul>
        </div>

        {canManage && pip.status === "ACTIVE" && (
          <div className="flex flex-wrap items-center gap-2 border-t pt-3">
            <form action={checkInAction} className="flex items-center gap-2">
              <input type="hidden" name="pipId" value={pip.id} />
              <Input name="note" placeholder="Add a check-in note" required className="h-7 w-48 text-xs" />
              <Button type="submit" variant="outline" size="xs" disabled={checkInPending}>
                {checkInPending ? "…" : "Add check-in"}
              </Button>
            </form>
            <form action={closeAction} className="flex items-center gap-2">
              <input type="hidden" name="pipId" value={pip.id} />
              <NativeSelect name="status" defaultValue="COMPLETED_SUCCESS" className="h-7 w-40 text-xs">
                <option value="COMPLETED_SUCCESS">Completed — success</option>
                <option value="COMPLETED_FAILURE">Completed — failure</option>
                <option value="CANCELLED">Cancelled</option>
              </NativeSelect>
              <Input name="outcomeNotes" placeholder="Outcome notes (optional)" className="h-7 w-44 text-xs" />
              <Button type="submit" variant="outline" size="xs" disabled={closePending}>
                {closePending ? "…" : "Close"}
              </Button>
            </form>
          </div>
        )}
        {(checkInState.error || closeState.error) && (
          <p className="text-xs text-destructive">{checkInState.error || closeState.error}</p>
        )}
      </CardContent>
    </Card>
  );
}
