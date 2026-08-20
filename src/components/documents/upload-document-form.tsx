"use client";

import { useActionState } from "react";

import { uploadOnboardingDocument, type UploadDocumentState } from "@/lib/actions/onboarding";
import { ALLOWED_CONTENT_TYPES_LABEL, MAX_FILE_SIZE_LABEL } from "@/lib/document-upload";

const initialState: UploadDocumentState = {};

export function UploadDocumentForm({ documentId }: { documentId: string }) {
  const [state, formAction, pending] = useActionState(uploadOnboardingDocument, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="documentId" value={documentId} />
      <input
        type="file"
        name="file"
        required
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="text-xs"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
      >
        {pending ? "Uploading…" : "Upload"}
      </button>
      {state.error && (
        <p className="w-full text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <p className="w-full text-[11px] text-black/40 dark:text-white/40">
        {ALLOWED_CONTENT_TYPES_LABEL}, up to {MAX_FILE_SIZE_LABEL}.
      </p>
    </form>
  );
}
