"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initiateExit, type InitiateExitState } from "@/lib/actions/exit";

const initialState: InitiateExitState = {};

export function InitiateExitForm({ employeeId }: { employeeId: string }) {
  const [state, formAction, pending] = useActionState(initiateExit, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record resignation</CardTitle>
        <CardDescription>
          Moves status to Notice Period and creates the exit checklist (PRD §24).
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="employeeId" value={employeeId} />
        <CardContent className="flex flex-wrap items-end gap-3">
          <FormField label="Resignation date" htmlFor="resignationDate">
            <Input id="resignationDate" type="date" name="resignationDate" required />
          </FormField>
          <FormField label="Notice period (days)" htmlFor="noticePeriodDays">
            <Input
              id="noticePeriodDays"
              type="number"
              name="noticePeriodDays"
              min={0}
              required
              defaultValue={30}
            />
          </FormField>
          <FormField label="Reason (optional)" htmlFor="reason" className="min-w-[12rem] flex-1">
            <Input id="reason" name="reason" />
          </FormField>
          <Button type="submit" variant="outline" disabled={pending}>
            {pending ? "Saving…" : "Start exit process"}
          </Button>

          {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </form>
    </Card>
  );
}
