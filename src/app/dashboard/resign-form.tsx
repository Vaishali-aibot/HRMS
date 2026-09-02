"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitResignationRequest, type ResignationActionState } from "@/lib/actions/resignation";

const initialState: ResignationActionState = {};

export function ResignForm() {
  const [state, formAction, pending] = useActionState(submitResignationRequest, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="resignationDate">Resignation date</Label>
        <Input type="date" id="resignationDate" name="resignationDate" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="noticePeriodDays">Notice period (days)</Label>
        <Input
          type="number"
          id="noticePeriodDays"
          name="noticePeriodDays"
          min={0}
          defaultValue={30}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label htmlFor="reason">Reason (optional)</Label>
        <Textarea id="reason" name="reason" rows={2} />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Submitting…" : "Submit resignation"}
        </Button>
      </div>
      {state.error && (
        <p className="text-xs text-destructive sm:col-span-2">{state.error}</p>
      )}
    </form>
  );
}
