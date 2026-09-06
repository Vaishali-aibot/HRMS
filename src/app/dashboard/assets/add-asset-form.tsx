"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { createAsset, type AssetActionState } from "@/lib/actions/asset";

const initialState: AssetActionState = {};

export function AddAssetForm() {
  const [state, formAction, pending] = useActionState(createAsset, initialState);

  return (
    <Card>
      <form action={formAction}>
        <CardContent className="flex flex-wrap items-end gap-3">
          <FormField label="Type" htmlFor="type">
            <Input id="type" name="type" required placeholder="Laptop" />
          </FormField>
          <FormField label="Serial number (optional)" htmlFor="serialNumber">
            <Input id="serialNumber" name="serialNumber" />
          </FormField>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add asset"}
          </Button>
          {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </form>
    </Card>
  );
}
