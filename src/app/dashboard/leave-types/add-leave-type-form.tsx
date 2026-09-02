"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { createLeaveType, type LeaveTypeState } from "@/lib/actions/leave-type";

const initialState: LeaveTypeState = {};

export function AddLeaveTypeForm() {
  const [state, formAction, pending] = useActionState(createLeaveType, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3 rounded-xl border p-4">
      <FormField label="Name" htmlFor="name">
        <Input id="name" name="name" required />
      </FormField>
      <FormField label="Annual days" htmlFor="annualDays">
        <Input id="annualDays" type="number" name="annualDays" min={0} step="0.5" required />
      </FormField>
      <FormField label="Carry-forward limit" htmlFor="carryForwardLimit">
        <Input
          id="carryForwardLimit"
          type="number"
          name="carryForwardLimit"
          min={0}
          step="0.5"
          placeholder="0"
        />
      </FormField>
      <FormField label="Accrual" htmlFor="accrualMethod">
        <NativeSelect id="accrualMethod" name="accrualMethod" defaultValue="ANNUAL">
          <option value="ANNUAL">Annual (all at once)</option>
          <option value="MONTHLY">Monthly (1/12 per month)</option>
          <option value="QUARTERLY">Quarterly (1/4 per quarter)</option>
        </NativeSelect>
      </FormField>
      <FormField
        label="Monthly cap"
        htmlFor="monthlyCap"
        className="w-32"
      >
        <Input
          id="monthlyCap"
          type="number"
          name="monthlyCap"
          min={0}
          step="0.5"
          placeholder="none"
          title="Caps this type per calendar month instead of an annual pool (e.g. WFH)"
        />
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add leave type"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
