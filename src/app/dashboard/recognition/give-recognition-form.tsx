"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/form-field";
import { giveRecognition, type RecognitionActionState } from "@/lib/actions/recognition";

const initialState: RecognitionActionState = {};

type EmployeeOption = { id: string; employeeCode: string; fullName: string };

export function GiveRecognitionForm({ employees }: { employees: EmployeeOption[] }) {
  const [state, formAction, pending] = useActionState(giveRecognition, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <FormField label="Recognize" htmlFor="toEmployeeId" className="sm:col-span-2">
        <NativeSelect id="toEmployeeId" name="toEmployeeId" required defaultValue="">
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
      <FormField label="Category" htmlFor="category">
        <NativeSelect id="category" name="category" defaultValue="TEAMWORK">
          <option value="TEAMWORK">Teamwork</option>
          <option value="INNOVATION">Innovation</option>
          <option value="CUSTOMER_FOCUS">Customer focus</option>
          <option value="LEADERSHIP">Leadership</option>
          <option value="GOING_ABOVE_AND_BEYOND">Going above &amp; beyond</option>
          <option value="OTHER">Other</option>
        </NativeSelect>
      </FormField>
      <FormField label="Points (1-100)" htmlFor="points">
        <Input id="points" type="number" name="points" min={1} max={100} defaultValue={10} />
      </FormField>
      <FormField label="Message" htmlFor="message" className="sm:col-span-2">
        <Textarea id="message" name="message" required rows={2} />
      </FormField>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Give recognition"}
        </Button>
      </div>
      {state.error && (
        <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>
      )}
    </form>
  );
}
