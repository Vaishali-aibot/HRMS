"use client";

import { useActionState } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
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
        className="max-w-56 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border file:border-input file:bg-transparent file:px-2 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-muted"
      />
      <Button type="submit" variant="outline" size="xs" disabled={pending}>
        <Upload />
        {pending ? "Uploading…" : "Upload"}
      </Button>
      {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
      <p className="w-full text-[11px] text-muted-foreground">
        {ALLOWED_CONTENT_TYPES_LABEL}, up to {MAX_FILE_SIZE_LABEL}.
      </p>
    </form>
  );
}
