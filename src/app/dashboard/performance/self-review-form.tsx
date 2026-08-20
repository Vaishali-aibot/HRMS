"use client";

import { useActionState } from "react";

import { submitSelfReview, type PerformanceReviewState } from "@/lib/actions/performance-review";

const initialState: PerformanceReviewState = {};

const ratingSelectClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20";

export function SelfReviewForm({
  cycleId,
  goals,
}: {
  cycleId: string;
  goals: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(submitSelfReview, initialState);

  return (
    <form
      action={formAction}
      className="mt-2 space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <input type="hidden" name="cycleId" value={cycleId} />
      <p className="text-sm font-semibold">Submit self-review</p>
      {goals.map((goal) => (
        <label key={goal.id} className="flex items-center justify-between gap-3 text-sm">
          <span>{goal.title}</span>
          <select name={`selfRating_${goal.id}`} required defaultValue="" className={ratingSelectClass}>
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
      ))}
      <label className="block text-sm">
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
        {pending ? "Submitting…" : "Submit self-review"}
      </button>
      {state.error && <p className="text-xs text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
