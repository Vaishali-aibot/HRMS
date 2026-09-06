"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import {
  submitManagerReview,
  type PerformanceReviewState,
} from "@/lib/actions/performance-review";

const initialState: PerformanceReviewState = {};

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
    <Card size="sm">
      <CardContent className="flex flex-col gap-3">
        <div className="font-medium">
          {employeeName} · {cycleName}
        </div>
        {selfComments && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Self comments:</span> {selfComments}
          </p>
        )}
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="employeeId" value={employeeId} />
          <input type="hidden" name="cycleId" value={cycleId} />
          {goals.map((goal) => (
            <label key={goal.id} className="flex items-center justify-between gap-3 text-sm">
              <span>
                {goal.title}
                {goal.selfRating && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    (self: {goal.selfRating}/5)
                  </span>
                )}
              </span>
              <NativeSelect
                name={`managerRating_${goal.id}`}
                required
                defaultValue=""
                className="h-7 w-24 text-xs"
              >
                <option value="" disabled>
                  Rate 1-5
                </option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </NativeSelect>
            </label>
          ))}
          <label className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Overall rating</span>
            <NativeSelect
              name="overallRating"
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
          <FormField label="Overall comments" htmlFor={`comments-${employeeId}-${cycleId}`}>
            <Textarea id={`comments-${employeeId}-${cycleId}`} name="comments" rows={3} />
          </FormField>
          <div>
            <Button type="submit" variant="outline" disabled={pending}>
              {pending ? "Submitting…" : "Submit manager review"}
            </Button>
          </div>
          {state.error && <p className="text-xs text-destructive">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
