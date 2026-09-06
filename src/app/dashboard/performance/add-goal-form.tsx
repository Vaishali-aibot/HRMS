"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addGoal, type GoalActionState } from "@/lib/actions/goal";

const initialState: GoalActionState = {};

export function AddGoalForm({ employeeId, cycleId }: { employeeId: string; cycleId: string }) {
  const [state, formAction, pending] = useActionState(addGoal, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_1fr_auto]">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="cycleId" value={cycleId} />
      <Input name="title" placeholder="Goal title" required />
      <Input type="number" name="weight" min={0} max={100} placeholder="Weight % (optional)" />
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Adding…" : "Add goal"}
      </Button>
      <Textarea
        name="description"
        placeholder="Description (optional)"
        className="sm:col-span-3"
        rows={2}
      />
      {state.error && <p className="text-xs text-destructive sm:col-span-3">{state.error}</p>}
    </form>
  );
}
