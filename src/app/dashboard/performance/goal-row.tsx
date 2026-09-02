"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/status-badge";
import { deleteGoal, updateGoalStatus, type GoalActionState } from "@/lib/actions/goal";

const initialState: GoalActionState = {};

export function GoalRow({
  goal,
  canUpdateStatus,
  canDelete,
}: {
  goal: {
    id: string;
    title: string;
    description: string | null;
    weight: number;
    status: string;
    selfRating: number | null;
    managerRating: number | null;
  };
  canUpdateStatus: boolean;
  canDelete: boolean;
}) {
  const [statusState, statusAction, statusPending] = useActionState(
    updateGoalStatus,
    initialState
  );
  const [deleteState, deleteAction, deletePending] = useActionState(deleteGoal, initialState);

  return (
    <li className="rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{goal.title}</span>
          {goal.weight > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">{goal.weight}% weight</span>
          )}
        </div>
        <StatusBadge status={goal.status} />
      </div>
      {goal.description && <p className="mt-1 text-muted-foreground">{goal.description}</p>}
      {(goal.selfRating || goal.managerRating) && (
        <p className="mt-1 text-xs text-muted-foreground">
          {goal.selfRating && `Self rating: ${goal.selfRating}/5`}
          {goal.selfRating && goal.managerRating && " · "}
          {goal.managerRating && `Manager rating: ${goal.managerRating}/5`}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canUpdateStatus && (
          <form action={statusAction} className="flex items-center gap-2">
            <input type="hidden" name="goalId" value={goal.id} />
            <NativeSelect name="status" defaultValue={goal.status} className="h-7 w-32 text-xs">
              <option value="NOT_STARTED">Not started</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
            </NativeSelect>
            <Button type="submit" variant="outline" size="xs" disabled={statusPending}>
              {statusPending ? "…" : "Update"}
            </Button>
          </form>
        )}
        {canDelete && (
          <form action={deleteAction}>
            <input type="hidden" name="goalId" value={goal.id} />
            <Button type="submit" variant="outline" size="xs" disabled={deletePending}>
              {deletePending ? "…" : "Remove"}
            </Button>
          </form>
        )}
      </div>
      {(statusState.error || deleteState.error) && (
        <p className="mt-1 text-xs text-destructive">
          {statusState.error || deleteState.error}
        </p>
      )}
    </li>
  );
}
