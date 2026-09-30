"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { addMyAsset, type EmployeeAssetActionState } from "@/lib/actions/employee-asset";

import { AssetCategoryFields, ASSET_CATEGORY_LABELS, type AssetCategory } from "./asset-category-fields";

const initialState: EmployeeAssetActionState = {};

export function AddMyAssetForm() {
  const [state, formAction, pending] = useActionState(addMyAsset, initialState);
  const [category, setCategory] = useState<AssetCategory>("LAPTOP");

  return (
    <Card>
      <form action={formAction}>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Category" htmlFor="add-category" className="sm:col-span-2">
            <NativeSelect
              id="add-category"
              name="category"
              value={category}
              onChange={(e) => setCategory(e.target.value as AssetCategory)}
            >
              {Object.entries(ASSET_CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </NativeSelect>
          </FormField>

          <AssetCategoryFields category={category} idPrefix="add" />

          {state.error && <p className="text-sm text-destructive sm:col-span-2">{state.error}</p>}
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Add item"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
