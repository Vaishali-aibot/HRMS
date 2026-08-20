"use client";

import { useActionState } from "react";

import { createAsset, type AssetActionState } from "@/lib/actions/asset";

const initialState: AssetActionState = {};

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

export function AddAssetForm() {
  const [state, formAction, pending] = useActionState(createAsset, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Type</span>
        <input name="type" required placeholder="Laptop" className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Serial number (optional)</span>
        <input name="serialNumber" className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Adding…" : "Add asset"}
      </button>
      {state.error && (
        <p className="w-full text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
