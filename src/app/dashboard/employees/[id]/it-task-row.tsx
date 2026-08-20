"use client";

import { useActionState } from "react";

import { updateITTaskStatus, type UpdateChecklistState } from "@/lib/actions/onboarding";

const initialState: UpdateChecklistState = {};

const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"] as const;

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20";

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
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 px-3 py-2 text-sm first:border-t-0 dark:border-white/10">
      <span>{task.type.replaceAll("_", " ")}</span>
      {editable ? (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="taskId" value={task.id} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <select name="status" defaultValue={task.status} className={inputClass}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            {pending ? "…" : "Save"}
          </button>
        </form>
      ) : (
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {task.status.replaceAll("_", " ")}
        </span>
      )}
      {state.error && (
        <p className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </li>
  );
}
