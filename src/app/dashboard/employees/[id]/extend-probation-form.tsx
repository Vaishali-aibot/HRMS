"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { extendProbation, type ExtendProbationState } from "@/lib/actions/employee-detail";

const initialState: ExtendProbationState = {};

export function ExtendProbationForm({
  employeeId,
  currentEndDate,
}: {
  employeeId: string;
  currentEndDate: string;
}) {
  const [state, formAction, pending] = useActionState(extendProbation, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extend probation</CardTitle>
        <CardDescription>Current end date: {currentEndDate}</CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="employeeId" value={employeeId} />
        <CardContent className="flex flex-wrap items-end gap-3">
          <FormField label="New end date" htmlFor="newProbationEndDate">
            <Input id="newProbationEndDate" type="date" name="newProbationEndDate" required />
          </FormField>
          <FormField label="Reason" htmlFor="reason" className="min-w-[12rem] flex-1">
            <Input id="reason" name="reason" required />
          </FormField>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Saving…" : "Extend"}
          </Button>

          {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </form>
    </Card>
  );
}
