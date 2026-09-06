"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  updatePerformanceCycleStatus,
  type PerformanceCycleState,
} from "@/lib/actions/performance-cycle";

const initialState: PerformanceCycleState = {};

export function CycleRow({
  cycle,
}: {
  cycle: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    status: string;
  };
}) {
  const [state, formAction, pending] = useActionState(updatePerformanceCycleStatus, initialState);

  return (
    <TableRow>
      <TableCell className="font-medium">{cycle.name}</TableCell>
      <TableCell className="text-muted-foreground">
        {cycle.startDate} → {cycle.endDate}
      </TableCell>
      <TableCell>
        <form action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="cycleId" value={cycle.id} />
          <NativeSelect name="status" defaultValue={cycle.status} className="h-7 w-28 text-xs">
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="CLOSED">Closed</option>
          </NativeSelect>
          <Button type="submit" variant="outline" size="xs" disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </form>
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      </TableCell>
    </TableRow>
  );
}
