"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { createPIP, type PIPActionState } from "@/lib/actions/pip";

const initialState: PIPActionState = {};

type EmployeeOption = { id: string; employeeCode: string; fullName: string };

export function CreatePIPForm({ employees }: { employees: EmployeeOption[] }) {
  const [state, formAction, pending] = useActionState(createPIP, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start a PIP</CardTitle>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Employee" htmlFor="employeeId" className="sm:col-span-2">
            <NativeSelect id="employeeId" name="employeeId" required defaultValue="">
              <option value="" disabled>
                Select…
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} — {e.fullName}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Start date" htmlFor="startDate">
            <Input id="startDate" type="date" name="startDate" required />
          </FormField>
          <FormField label="End date" htmlFor="endDate">
            <Input id="endDate" type="date" name="endDate" required />
          </FormField>
          <FormField label="Reason" htmlFor="reason" className="sm:col-span-2">
            <Textarea id="reason" name="reason" required rows={2} />
          </FormField>
          <FormField label="Improvement goals / expectations" htmlFor="goals" className="sm:col-span-2">
            <Textarea id="goals" name="goals" required rows={3} />
          </FormField>

          {state.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Starting…" : "Start PIP"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
