"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { updateExitChecklistItem, type UpdateExitChecklistState } from "@/lib/actions/exit";

const initialState: UpdateExitChecklistState = {};

export function ExitChecklistRow({
  item,
  employeeId,
  editable,
}: {
  item: { id: string; type: string; status: string };
  employeeId: string;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateExitChecklistItem, initialState);
  const completed = item.status === "COMPLETED";

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2.5 text-sm first:border-t-0">
      <span className="font-medium">{item.type.replaceAll("_", " ")}</span>
      {editable ? (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="status" value={completed ? "PENDING" : "COMPLETED"} />
          <Button type="submit" variant="outline" size="xs" disabled={pending}>
            {pending ? "…" : completed ? "Mark pending" : "Mark completed"}
          </Button>
        </form>
      ) : (
        <StatusBadge status={item.status} />
      )}
      {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
    </li>
  );
}
