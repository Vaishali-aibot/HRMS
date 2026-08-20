"use client";

import { useActionState } from "react";

import { addPIPCheckIn, closePIP, type PIPActionState } from "@/lib/actions/pip";

const initialState: PIPActionState = {};

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20";
const buttonClass =
  "rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10";

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
    <li className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {pip.employeeName && <span className="font-medium">{pip.employeeName} · </span>}
          {pip.startDate} → {pip.endDate}
        </div>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {pip.status.replaceAll("_", " ")}
        </span>
      </div>
      <p className="mt-1 text-black/60 dark:text-white/60">
        <span className="font-medium">Reason:</span> {pip.reason}
      </p>
      <p className="mt-1 text-black/60 dark:text-white/60">
        <span className="font-medium">Goals:</span> {pip.goals}
      </p>
      {pip.outcomeNotes && (
        <p className="mt-1 text-black/60 dark:text-white/60">
          <span className="font-medium">Outcome:</span> {pip.outcomeNotes}
        </p>
      )}

      <div className="mt-2">
        <p className="text-xs font-medium text-black/50 dark:text-white/50">Check-ins</p>
        <ul className="mt-1 space-y-1">
          {pip.checkIns.map((c) => (
            <li key={c.id} className="text-xs text-black/60 dark:text-white/60">
              {c.createdAt}: {c.note}
            </li>
          ))}
          {pip.checkIns.length === 0 && (
            <li className="text-xs text-black/40 dark:text-white/40">None yet.</li>
          )}
        </ul>
      </div>

      {canManage && pip.status === "ACTIVE" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <form action={checkInAction} className="flex items-center gap-2">
            <input type="hidden" name="pipId" value={pip.id} />
            <input name="note" placeholder="Add a check-in note" required className={inputClass} />
            <button type="submit" disabled={checkInPending} className={buttonClass}>
              {checkInPending ? "…" : "Add check-in"}
            </button>
          </form>
          <form action={closeAction} className="flex items-center gap-2">
            <input type="hidden" name="pipId" value={pip.id} />
            <select name="status" defaultValue="COMPLETED_SUCCESS" className={inputClass}>
              <option value="COMPLETED_SUCCESS">Completed — success</option>
              <option value="COMPLETED_FAILURE">Completed — failure</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <input name="outcomeNotes" placeholder="Outcome notes (optional)" className={inputClass} />
            <button type="submit" disabled={closePending} className={buttonClass}>
              {closePending ? "…" : "Close"}
            </button>
          </form>
        </div>
      )}
      {(checkInState.error || closeState.error) && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          {checkInState.error || closeState.error}
        </p>
      )}
    </li>
  );
}
