"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import {
  requestAttendanceCorrection,
  type CorrectionActionState,
} from "@/lib/actions/attendance-correction";

const initialState: CorrectionActionState = {};

const STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "HALF_DAY",
  "WORK_FROM_HOME",
  "HOLIDAY",
  "ON_LEAVE",
  "MISSING",
] as const;

export function RequestCorrectionForm() {
  const [state, formAction, pending] = useActionState(
    requestAttendanceCorrection,
    initialState
  );

  return (
    <Card>
      <form action={formAction}>
        <CardContent className="flex flex-wrap items-end gap-3">
          <FormField label="Date" htmlFor="date">
            <Input id="date" type="date" name="date" required />
          </FormField>
          <FormField label="Should be" htmlFor="requestedStatus">
            <NativeSelect id="requestedStatus" name="requestedStatus" className="w-40">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Reason" htmlFor="reason" className="min-w-[12rem] flex-1">
            <Input id="reason" name="reason" required />
          </FormField>
          <Button type="submit" disabled={pending}>
            {pending ? "Submitting…" : "Request correction"}
          </Button>
          {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </form>
    </Card>
  );
}
