"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { changeEmployeeStatus, type ChangeStatusState } from "@/lib/actions/employee-detail";

const initialState: ChangeStatusState = {};

const STATUSES = [
  "CANDIDATE",
  "OFFER_ACCEPTED",
  "PRE_BOARDING",
  "ONBOARDING",
  "PROBATION",
  "CONFIRMED",
  "ACTIVE",
  "NOTICE_PERIOD",
  "EXITED",
  "ALUMNI",
] as const;

export function StatusChangeForm({
  employeeId,
  currentStatus,
}: {
  employeeId: string;
  currentStatus: string;
}) {
  const [state, formAction, pending] = useActionState(changeEmployeeStatus, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle status</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="employeeId" value={employeeId} />
        <CardContent className="flex flex-wrap items-end gap-3">
          <FormField label="New status" htmlFor="newStatus" className="w-44">
            <NativeSelect id="newStatus" name="newStatus" defaultValue={currentStatus}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Reason (optional)" htmlFor="reason" className="min-w-[12rem] flex-1">
            <Input id="reason" name="reason" />
          </FormField>
          <Button type="submit" disabled={pending}>
            {pending ? "Updating…" : "Update status"}
          </Button>

          {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </form>
    </Card>
  );
}
