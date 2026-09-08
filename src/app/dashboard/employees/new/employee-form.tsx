"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { createEmployee, type CreateEmployeeState } from "@/lib/actions/employee";

const initialState: CreateEmployeeState = {};

type PotentialManager = {
  id: string;
  employeeCode: string;
  fullName: string;
};

export function NewEmployeeForm({
  potentialManagers,
}: {
  potentialManagers: PotentialManager[];
}) {
  // On success the action itself calls redirect("/dashboard/employees"),
  // which throws a redirect signal Next.js handles directly — no client
  // round trip needed to navigate away, so this state only ever needs to
  // carry an error.
  const [state, formAction, pending] = useActionState(createEmployee, initialState);
  // Every required field already has the HTML `required` attribute, so the
  // browser blocks submission on its own — but that's just a native
  // per-field tooltip, easy to miss in a two-column layout if the invalid
  // field has scrolled out of view, and it looks nothing like the styled
  // error below for a server-side (Zod) validation failure. This mirrors
  // that same message/styling for the native-validation case too, so a
  // missed required field is never silently unclear.
  const [clientError, setClientError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Add employee</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Creates the Employee Master record and starts the lifecycle at{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">PRE_BOARDING</code>. Compensation
        and statutory details are entered separately once access-restricted fields are wired up.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Employee details</CardTitle>
          <CardDescription>Fields marked required must be filled in.</CardDescription>
        </CardHeader>
        <form
          action={formAction}
          onInvalidCapture={() =>
            setClientError("Please fill in all required fields (marked above) before submitting.")
          }
          onSubmit={() => setClientError(null)}
        >
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Full name" htmlFor="fullName">
              <Input id="fullName" name="fullName" required />
            </FormField>
            <FormField label="Personal email" htmlFor="personalEmail">
              <Input id="personalEmail" name="personalEmail" type="email" />
            </FormField>
            <FormField label="Date of joining" htmlFor="dateOfJoining">
              <Input id="dateOfJoining" name="dateOfJoining" type="date" required />
            </FormField>
            <FormField label="Probation period (days)" htmlFor="probationPeriodDays">
              <Input
                id="probationPeriodDays"
                name="probationPeriodDays"
                type="number"
                min={1}
                placeholder="3 months (default)"
              />
            </FormField>
            <FormField label="Department" htmlFor="department">
              <Input id="department" name="department" required />
            </FormField>
            <FormField label="Designation" htmlFor="designation">
              <Input id="designation" name="designation" required />
            </FormField>
            <FormField label="Location" htmlFor="location">
              <Input id="location" name="location" />
            </FormField>
            <FormField label="Employment type" htmlFor="employmentType">
              <NativeSelect id="employmentType" name="employmentType" defaultValue="FULL_TIME">
                <option value="FULL_TIME">Full-time</option>
                <option value="PART_TIME">Part-time</option>
                <option value="CONTRACT">Contract</option>
                <option value="INTERN">Intern</option>
              </NativeSelect>
            </FormField>
            <FormField label="Work mode" htmlFor="workMode">
              <NativeSelect id="workMode" name="workMode" defaultValue="ON_SITE">
                <option value="ON_SITE">On-site</option>
                <option value="REMOTE">Remote</option>
                <option value="HYBRID">Hybrid</option>
              </NativeSelect>
            </FormField>
            <FormField
              label="Reporting manager (optional)"
              htmlFor="reportingManagerId"
              className="sm:col-span-2"
            >
              <NativeSelect id="reportingManagerId" name="reportingManagerId" defaultValue="">
                <option value="">— None —</option>
                {potentialManagers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.employeeCode} — {m.fullName}
                  </option>
                ))}
              </NativeSelect>
            </FormField>

            {(clientError || state.error) && (
              <p className="text-sm text-destructive sm:col-span-2">
                {clientError ?? state.error}
              </p>
            )}
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Create employee"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
