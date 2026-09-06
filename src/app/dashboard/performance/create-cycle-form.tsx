"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { createPerformanceCycle, type PerformanceCycleState } from "@/lib/actions/performance-cycle";

const initialState: PerformanceCycleState = {};

export function CreateCycleForm() {
  const [state, formAction, pending] = useActionState(createPerformanceCycle, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a cycle</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Name" htmlFor="name" className="sm:col-span-2">
            <Input id="name" name="name" placeholder="e.g. H1 2026" required />
          </FormField>
          <FormField label="Start date" htmlFor="startDate">
            <Input id="startDate" type="date" name="startDate" required />
          </FormField>
          <FormField label="End date" htmlFor="endDate">
            <Input id="endDate" type="date" name="endDate" required />
          </FormField>
          <FormField label="Self-review due (optional)" htmlFor="selfReviewDueDate">
            <Input id="selfReviewDueDate" type="date" name="selfReviewDueDate" />
          </FormField>
          <FormField label="Manager-review due (optional)" htmlFor="managerReviewDueDate">
            <Input id="managerReviewDueDate" type="date" name="managerReviewDueDate" />
          </FormField>

          {state.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create cycle"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
