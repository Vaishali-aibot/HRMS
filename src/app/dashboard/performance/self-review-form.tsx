"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { submitSelfReview, type PerformanceReviewState } from "@/lib/actions/performance-review";

const initialState: PerformanceReviewState = {};

export function SelfReviewForm({
  cycleId,
  goals,
}: {
  cycleId: string;
  goals: { id: string; title: string }[];
}) {
  const [state, formAction, pending] = useActionState(submitSelfReview, initialState);

  return (
    <form action={formAction} className="mt-2 flex flex-col gap-3 rounded-lg border p-4">
      <input type="hidden" name="cycleId" value={cycleId} />
      <p className="text-sm font-semibold">Submit self-review</p>
      {goals.map((goal) => (
        <label key={goal.id} className="flex items-center justify-between gap-3 text-sm">
          <span>{goal.title}</span>
          <NativeSelect
            name={`selfRating_${goal.id}`}
            required
            defaultValue=""
            className="h-7 w-40 text-xs"
          >
            <option value="" disabled>
              Rate 1-5
            </option>
            <option value="1">1 — Needs improvement</option>
            <option value="2">2 — Below expectations</option>
            <option value="3">3 — Meets expectations</option>
            <option value="4">4 — Exceeds expectations</option>
            <option value="5">5 — Outstanding</option>
          </NativeSelect>
        </label>
      ))}
      <FormField label="Overall comments" htmlFor="comments">
        <Textarea id="comments" name="comments" rows={3} />
      </FormField>
      <div>
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Submitting…" : "Submit self-review"}
        </Button>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
