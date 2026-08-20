"use client";

import { useActionState } from "react";

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
    <li className="flex flex-wrap items-center justify-between gap-2 border-t border-black/10 px-3 py-2 text-sm first:border-t-0 dark:border-white/10">
      <span>{item.type.replaceAll("_", " ")}</span>
      {editable ? (
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="status" value={completed ? "PENDING" : "COMPLETED"} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
          >
            {pending ? "…" : completed ? "Mark pending" : "Mark completed"}
          </button>
        </form>
      ) : (
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {item.status}
        </span>
      )}
      {state.error && (
        <p className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </li>
  );
}
