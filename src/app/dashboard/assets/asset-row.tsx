"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { TableCell, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import {
  assignAsset,
  reportAssetLost,
  retireAsset,
  returnAsset,
  updateAssetCondition,
  type AssetActionState,
} from "@/lib/actions/asset";

const initialState: AssetActionState = {};

type EmployeeOption = { id: string; employeeCode: string; fullName: string };
type HistoryEntry = {
  id: string;
  action: string;
  condition: string | null;
  notes: string | null;
  occurredAt: string;
  employeeName: string | null;
};

export function AssetRow({
  asset,
  employees,
}: {
  asset: {
    id: string;
    assetCode: string;
    type: string;
    serialNumber: string | null;
    status: string;
    assignedEmployee: { employeeCode: string; fullName: string } | null;
    history: HistoryEntry[];
  };
  employees: EmployeeOption[];
}) {
  const [assignState, assignAction, assignPending] = useActionState(assignAsset, initialState);
  const [returnState, returnAction, returnPending] = useActionState(returnAsset, initialState);
  const [conditionState, conditionAction, conditionPending] = useActionState(
    updateAssetCondition,
    initialState
  );
  const [retireState, retireAction, retirePending] = useActionState(retireAsset, initialState);
  const [lostState, lostAction, lostPending] = useActionState(reportAssetLost, initialState);

  const canAssign = asset.status === "AVAILABLE" || asset.status === "RETURNED";
  const canReturn = asset.status === "ASSIGNED";
  const isEndOfLife = asset.status === "RETIRED" || asset.status === "LOST";

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{asset.assetCode}</TableCell>
      <TableCell>
        {asset.type}
        {asset.serialNumber && (
          <div className="text-xs text-muted-foreground">{asset.serialNumber}</div>
        )}
      </TableCell>
      <TableCell>
        <StatusBadge status={asset.status} />
        {asset.assignedEmployee && (
          <div className="mt-1 text-xs text-muted-foreground">
            {asset.assignedEmployee.employeeCode} — {asset.assignedEmployee.fullName}
          </div>
        )}
      </TableCell>
      <TableCell>
        {canAssign && (
          <form action={assignAction} className="flex items-center gap-2">
            <input type="hidden" name="assetId" value={asset.id} />
            <NativeSelect name="employeeId" defaultValue="" className="h-7 w-40 text-xs">
              <option value="" disabled>
                Assign to…
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} — {e.fullName}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" variant="outline" size="xs" disabled={assignPending}>
              {assignPending ? "…" : "Assign"}
            </Button>
          </form>
        )}
        {canReturn && (
          <form action={returnAction} className="flex items-center gap-2">
            <input type="hidden" name="assetId" value={asset.id} />
            <Input name="condition" placeholder="Condition (optional)" className="h-7 w-40 text-xs" />
            <Button type="submit" variant="outline" size="xs" disabled={returnPending}>
              {returnPending ? "…" : "Mark returned"}
            </Button>
          </form>
        )}
        {!isEndOfLife && (
          <form action={conditionAction} className="mt-2 flex items-center gap-2">
            <input type="hidden" name="assetId" value={asset.id} />
            <Input
              name="condition"
              placeholder="Condition/damage note"
              required
              className="h-7 w-40 text-xs"
            />
            <Button type="submit" variant="outline" size="xs" disabled={conditionPending}>
              {conditionPending ? "…" : "Log condition"}
            </Button>
          </form>
        )}
        {!isEndOfLife && (
          <div className="mt-2 flex items-center gap-2">
            <form action={retireAction}>
              <input type="hidden" name="assetId" value={asset.id} />
              <Button type="submit" variant="outline" size="xs" disabled={retirePending}>
                {retirePending ? "…" : "Retire"}
              </Button>
            </form>
            <form action={lostAction}>
              <input type="hidden" name="assetId" value={asset.id} />
              <Button type="submit" variant="outline" size="xs" disabled={lostPending}>
                {lostPending ? "…" : "Report lost"}
              </Button>
            </form>
          </div>
        )}
        {(assignState.error ||
          returnState.error ||
          conditionState.error ||
          retireState.error ||
          lostState.error) && (
          <p className="mt-1 text-xs text-destructive">
            {assignState.error ||
              returnState.error ||
              conditionState.error ||
              retireState.error ||
              lostState.error}
          </p>
        )}
        {asset.history.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
              History ({asset.history.length})
            </summary>
            <ul className="mt-1 flex flex-col gap-1">
              {asset.history.map((h) => (
                <li key={h.id} className="text-xs text-muted-foreground">
                  {h.occurredAt}: {h.action.replaceAll("_", " ")}
                  {h.employeeName && ` — ${h.employeeName}`}
                  {h.condition && ` (${h.condition})`}
                  {h.notes && ` — ${h.notes}`}
                </li>
              ))}
            </ul>
          </details>
        )}
      </TableCell>
    </TableRow>
  );
}
