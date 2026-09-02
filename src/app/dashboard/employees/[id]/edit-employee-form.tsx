"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { updateEmployee, type UpdateEmployeeState } from "@/lib/actions/employee-detail";

const initialState: UpdateEmployeeState = {};

type PotentialManager = { id: string; employeeCode: string; fullName: string };

export function EditEmployeeForm({
  employee,
  potentialManagers,
}: {
  employee: {
    id: string;
    fullName: string;
    personalEmail: string | null;
    department: string;
    designation: string;
    location: string | null;
    employmentType: string;
    workMode: string;
    reportingManagerId: string | null;
  };
  potentialManagers: PotentialManager[];
}) {
  const [state, formAction, pending] = useActionState(updateEmployee, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Employee details</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <input type="hidden" name="employeeId" value={employee.id} />
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Full name" htmlFor="fullName">
            <Input id="fullName" name="fullName" defaultValue={employee.fullName} required />
          </FormField>
          <FormField label="Personal email" htmlFor="personalEmail">
            <Input
              id="personalEmail"
              name="personalEmail"
              type="email"
              defaultValue={employee.personalEmail ?? ""}
            />
          </FormField>
          <FormField label="Department" htmlFor="department">
            <Input id="department" name="department" defaultValue={employee.department} required />
          </FormField>
          <FormField label="Designation" htmlFor="designation">
            <Input
              id="designation"
              name="designation"
              defaultValue={employee.designation}
              required
            />
          </FormField>
          <FormField label="Location" htmlFor="location">
            <Input id="location" name="location" defaultValue={employee.location ?? ""} />
          </FormField>
          <FormField label="Employment type" htmlFor="employmentType">
            <NativeSelect
              id="employmentType"
              name="employmentType"
              defaultValue={employee.employmentType}
            >
              <option value="FULL_TIME">Full-time</option>
              <option value="PART_TIME">Part-time</option>
              <option value="CONTRACT">Contract</option>
              <option value="INTERN">Intern</option>
            </NativeSelect>
          </FormField>
          <FormField label="Work mode" htmlFor="workMode">
            <NativeSelect id="workMode" name="workMode" defaultValue={employee.workMode}>
              <option value="ON_SITE">On-site</option>
              <option value="REMOTE">Remote</option>
              <option value="HYBRID">Hybrid</option>
            </NativeSelect>
          </FormField>
          <FormField label="Reporting manager" htmlFor="reportingManagerId">
            <NativeSelect
              id="reportingManagerId"
              name="reportingManagerId"
              defaultValue={employee.reportingManagerId ?? ""}
            >
              <option value="">— None —</option>
              {potentialManagers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.employeeCode} — {m.fullName}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          {state.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
