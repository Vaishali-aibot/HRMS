"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  deleteMyAsset,
  updateMyAsset,
  type EmployeeAssetActionState,
} from "@/lib/actions/employee-asset";

import { AssetCategoryFields, ASSET_CATEGORY_LABELS, type AssetCategory } from "./asset-category-fields";

const initialState: EmployeeAssetActionState = {};

type Asset = {
  id: string;
  category: AssetCategory;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  processor: string | null;
  ram: string | null;
  operatingSystem: string | null;
  assetTag: string | null;
  otherDescription: string | null;
  notes: string | null;
};

function summaryLine(asset: Asset): string {
  const parts = [asset.brand, asset.model, asset.otherDescription].filter(Boolean);
  return parts.length > 0 ? parts.join(" — ") : ASSET_CATEGORY_LABELS[asset.category];
}

function detailLines(asset: Asset): { label: string; value: string }[] {
  const lines: { label: string; value: string }[] = [];
  if (asset.serialNumber) lines.push({ label: "Serial No.", value: asset.serialNumber });
  if (asset.processor) lines.push({ label: "Processor", value: asset.processor });
  if (asset.ram) lines.push({ label: "RAM", value: asset.ram });
  if (asset.operatingSystem) lines.push({ label: "OS", value: asset.operatingSystem });
  if (asset.assetTag) lines.push({ label: "Asset tag", value: asset.assetTag });
  if (asset.notes) lines.push({ label: "Notes", value: asset.notes });
  return lines;
}

export function MyAssetCard({ asset }: { asset: Asset }) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(updateMyAsset, initialState);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteMyAsset, initialState);

  // Close the edit form once a submitted update comes back clean. Can't key
  // this off updateState alone — its shape ({} = no error) is identical
  // before the first submit and after a successful one — so a ref tracks
  // whether this specific card actually submitted.
  const submittedRef = useRef(false);
  useEffect(() => {
    if (submittedRef.current && !updatePending && !updateState.error) {
      submittedRef.current = false;
      setEditing(false);
    }
  }, [updatePending, updateState]);

  if (editing) {
    return (
      <Card size="sm">
        <form action={updateAction} onSubmit={() => (submittedRef.current = true)}>
          <input type="hidden" name="id" value={asset.id} />
          {/* Category isn't user-editable here (each category has a different field
              set — changing it would leave stale fields behind), but the update
              action's schema still validates it, so it has to ride along as hidden. */}
          <input type="hidden" name="category" value={asset.category} />
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <p className="text-xs font-medium text-muted-foreground sm:col-span-2">
              {ASSET_CATEGORY_LABELS[asset.category]}
            </p>
            <AssetCategoryFields category={asset.category} defaults={asset} idPrefix={`edit-${asset.id}`} />
            {updateState.error && (
              <p className="text-sm text-destructive sm:col-span-2">{updateState.error}</p>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={updatePending}>
              {updatePending ? "Saving…" : "Save"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{summaryLine(asset)}</span>
            <span className="text-xs text-muted-foreground">
              {ASSET_CATEGORY_LABELS[asset.category]}
            </span>
          </div>
          {detailLines(asset).length > 0 && (
            <dl className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
              {detailLines(asset).map((d) => (
                <div key={d.label}>
                  <span className="font-medium">{d.label}:</span> {d.value}
                </div>
              ))}
            </dl>
          )}
          {(updateState.error || deleteState.error) && (
            <p className="mt-1 text-xs text-destructive">{updateState.error || deleteState.error}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <form action={deleteAction}>
            <input type="hidden" name="id" value={asset.id} />
            <Button type="submit" variant="outline" size="xs" disabled={deletePending}>
              {deletePending ? "…" : "Delete"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
