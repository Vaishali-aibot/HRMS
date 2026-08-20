"use client";

import { useActionState } from "react";

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
    <li className="rounded-md border border-black/10 p-3 text-sm dark:border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="font-medium">{goal.title}</span>
          {goal.weight > 0 && (
            <span className="ml-2 text-xs text-black/50 dark:text-white/50">
              {goal.weight}% weight
            </span>
          )}
        </div>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {goal.status.replaceAll("_", " ")}
        </span>
      </div>
      {goal.description && (
        <p className="mt-1 text-black/60 dark:text-white/60">{goal.description}</p>
      )}
      {(goal.selfRating || goal.managerRating) && (
        <p className="mt-1 text-xs text-black/50 dark:text-white/50">
          {goal.selfRating && `Self rating: ${goal.selfRating}/5`}
          {goal.selfRating && goal.managerRating && " · "}
          {goal.managerRating && `Manager rating: ${goal.managerRating}/5`}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {canUpdateStatus && (
          <form action={statusAction} className="flex items-center gap-2">
            <input type="hidden" name="goalId" value={goal.id} />
            <select
              name="status"
              defaultValue={goal.status}
              className="rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20"
            >
              <option value="NOT_STARTED">NOT STARTED</option>
              <option value="IN_PROGRESS">IN PROGRESS</option>
              <option value="COMPLETED">COMPLETED</option>
            </select>
            <button
              type="submit"
              disabled={statusPending}
              className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              {statusPending ? "…" : "Update"}
            </button>
          </form>
        )}
        {canDelete && (
          <form action={deleteAction}>
            <input type="hidden" name="goalId" value={goal.id} />
            <button
              type="submit"
              disabled={deletePending}
              className="rounded-md border border-black/15 px-2 py-1 text-xs hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              {deletePending ? "…" : "Remove"}
            </button>
          </form>
        )}
      </div>
      {(statusState.error || deleteState.error) && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {statusState.error || deleteState.error}
        </p>
      )}
    </li>
  );
}
