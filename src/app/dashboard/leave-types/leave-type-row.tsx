"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { TableCell, TableRow } from "@/components/ui/table";
import { updateLeaveType, type LeaveTypeState } from "@/lib/actions/leave-type";

const initialState: LeaveTypeState = {};

export function LeaveTypeRow({
  leaveType,
}: {
  leaveType: {
    id: string;
    name: string;
    annualDays: number;
    carryForwardLimit: number;
    accrualMethod: string;
    monthlyCap: number | null;
    isActive: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(updateLeaveType, initialState);

  return (
    <TableRow>
      <TableCell className="font-medium">{leaveType.name}</TableCell>
      <TableCell>
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="leaveTypeId" value={leaveType.id} />
          <label className="flex items-center gap-1 text-xs">
            Days
            <Input
              type="number"
              name="annualDays"
              min={0}
              step="0.5"
              defaultValue={leaveType.annualDays}
              className="h-7 w-16 text-xs"
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            Carry-forward
            <Input
              type="number"
              name="carryForwardLimit"
              min={0}
              step="0.5"
              defaultValue={leaveType.carryForwardLimit}
              title="Max days carried into next year"
              className="h-7 w-16 text-xs"
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            Accrual
            <NativeSelect
              name="accrualMethod"
              defaultValue={leaveType.accrualMethod}
              className="h-7 w-28 text-xs"
            >
              <option value="ANNUAL">Annual</option>
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
            </NativeSelect>
          </label>
          <label className="flex items-center gap-1 text-xs" title="Caps this type per calendar month instead of an annual pool (e.g. WFH)">
            Monthly cap
            <Input
              type="number"
              name="monthlyCap"
              min={0}
              step="0.5"
              placeholder="none"
              defaultValue={leaveType.monthlyCap ?? ""}
              className="h-7 w-16 text-xs"
            />
          </label>
          <label className="flex items-center gap-1 text-xs">
            {/* No hidden "false" fallback needed — an unchecked checkbox
                is simply absent from FormData, and the action treats a
                missing value as false. */}
            <input type="checkbox" name="isActive" value="true" defaultChecked={leaveType.isActive} />
            Active
          </label>
          <Button type="submit" variant="outline" size="xs" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      </TableCell>
    </TableRow>
  );
}
