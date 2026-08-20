"use client";

import { useActionState } from "react";

import {
  submitManagerReview,
  type PerformanceReviewState,
} from "@/lib/actions/performance-review";

const initialState: PerformanceReviewState = {};

const ratingSelectClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20";

export function ManagerReviewRow({
  employeeId,
  employeeName,
  cycleId,
  cycleName,
  goals,
  selfComments,
}: {
  employeeId: string;
  employeeName: string;
  cycleId: string;
  cycleName: string;
  goals: { id: string; title: string; selfRating: number | null }[];
  selfComments: string | null;
}) {
  const [state, formAction, pending] = useActionState(submitManagerReview, initialState);

  return (
    <li className="rounded-xl border border-black/10 p-4 text-sm dark:border-white/15">
      <div className="font-medium">
        {employeeName} · {cycleName}
      </div>
      {selfComments && (
        <p className="mt-1 text-black/60 dark:text-white/60">
          <span className="font-medium">Self comments:</span> {selfComments}
        </p>
      )}
      <form action={formAction} className="mt-3 space-y-3">
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="cycleId" value={cycleId} />
        {goals.map((goal) => (
          <label key={goal.id} className="flex items-center justify-between gap-3">
            <span>
              {goal.title}
              {goal.selfRating && (
                <span className="ml-2 text-xs text-black/50 dark:text-white/50">
                  (self: {goal.selfRating}/5)
                </span>
              )}
            </span>
            <select
              name={`managerRating_${goal.id}`}
              required
              defaultValue=""
              className={ratingSelectClass}
            >
              <option value="" disabled>
                Rate 1-5
              </option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </label>
        ))}
        <label className="flex items-center justify-between gap-3">
          <span className="font-medium">Overall rating</span>
          <select name="overallRating" required defaultValue="" className={ratingSelectClass}>
            <option value="" disabled>
              Rate 1-5
            </option>
            <option value="1">1 — Needs improvement</option>
            <option value="2">2 — Below expectations</option>
            <option value="3">3 — Meets expectations</option>
            <option value="4">4 — Exceeds expectations</option>
            <option value="5">5 — Outstanding</option>
          </select>
        </label>
        <label className="block">
          Overall comments
          <textarea
            name="comments"
            rows={3}
            className="mt-1 w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Submitting…" : "Submit manager review"}
        </button>
        {state.error && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}
      </form>
    </li>
  );
}
