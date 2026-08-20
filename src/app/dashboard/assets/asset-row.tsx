"use client";

import { useActionState } from "react";

import { assignAsset, returnAsset, type AssetActionState } from "@/lib/actions/asset";

const initialState: AssetActionState = {};

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20";
const buttonClass =
  "rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10";

type EmployeeOption = { id: string; employeeCode: string; fullName: string };

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
  };
  employees: EmployeeOption[];
}) {
  const [assignState, assignAction, assignPending] = useActionState(assignAsset, initialState);
  const [returnState, returnAction, returnPending] = useActionState(returnAsset, initialState);

  const canAssign = asset.status === "AVAILABLE" || asset.status === "RETURNED";
  const canReturn = asset.status === "ASSIGNED";

  return (
    <tr className="border-t border-black/10 align-top dark:border-white/10">
      <td className="px-4 py-2 font-mono text-xs">{asset.assetCode}</td>
      <td className="px-4 py-2">
        {asset.type}
        {asset.serialNumber && (
          <div className="text-xs text-black/50 dark:text-white/50">{asset.serialNumber}</div>
        )}
      </td>
      <td className="px-4 py-2">
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
          {asset.status.replaceAll("_", " ")}
        </span>
        {asset.assignedEmployee && (
          <div className="mt-1 text-xs text-black/60 dark:text-white/60">
            {asset.assignedEmployee.employeeCode} — {asset.assignedEmployee.fullName}
          </div>
        )}
      </td>
      <td className="px-4 py-2">
        {canAssign && (
          <form action={assignAction} className="flex items-center gap-2">
            <input type="hidden" name="assetId" value={asset.id} />
            <select name="employeeId" defaultValue="" className={inputClass}>
              <option value="" disabled>
                Assign to…
              </option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.employeeCode} — {e.fullName}
                </option>
              ))}
            </select>
            <button type="submit" disabled={assignPending} className={buttonClass}>
              {assignPending ? "…" : "Assign"}
            </button>
          </form>
        )}
        {canReturn && (
          <form action={returnAction} className="flex items-center gap-2">
            <input type="hidden" name="assetId" value={asset.id} />
            <input name="condition" placeholder="Condition (optional)" className={inputClass} />
            <button type="submit" disabled={returnPending} className={buttonClass}>
              {returnPending ? "…" : "Mark returned"}
            </button>
          </form>
        )}
        {(assignState.error || returnState.error) && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
            {assignState.error || returnState.error}
          </p>
        )}
      </td>
    </tr>
  );
}
