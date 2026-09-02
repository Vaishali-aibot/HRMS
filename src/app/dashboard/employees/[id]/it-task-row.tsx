"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/status-badge";
import { updateITTaskStatus, type UpdateChecklistState } from "@/lib/actions/onboarding";

const initialState: UpdateChecklistState = {};

const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

export function ITTaskRow({
  task,
  employeeId,
  editable,
}: {
  task: { id: string; type: string; status: string };
  employeeId: string;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateITTaskStatus, initialState);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2.5 text-sm first:border-t-0">
      <span className="font-medium">{task.type.replaceAll("_", " ")}</span>
      {editable ? (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <NativeSelect name="status" defaultValue={task.status} className="h-7 w-32 text-xs">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" size="xs" disabled={pending}>
            {pending ? "…" : "Save"}
          </Button>
        </form>
      ) : (
        <StatusBadge status={task.status} />
      )}
      {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
    </li>
  );
}
