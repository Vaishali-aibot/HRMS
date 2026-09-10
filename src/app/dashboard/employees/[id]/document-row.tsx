"use client";

import { useActionState } from "react";
import { Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { StatusBadge } from "@/components/status-badge";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";
import { updateDocumentStatus, type UpdateChecklistState } from "@/lib/actions/onboarding";

const initialState: UpdateChecklistState = {};

const STATUSES = [
  "NOT_SUBMITTED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "RESUBMISSION_REQUIRED",
] as const;

export function DocumentRow({
  document,
  employeeId,
  editable,
  history,
}: {
  document: { id: string; type: string; status: string; fileName: string | null };
  employeeId: string;
  editable: boolean;
  history?: { id: string; action: string; occurredAt: string; actorLabel: string }[];
}) {
  const [state, formAction, pending] = useActionState(updateDocumentStatus, initialState);

  return (
    <li className="border-t px-3 py-2.5 text-sm first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{document.type.replaceAll("_", " ")}</span>
        {editable ? (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="documentId" value={document.id} />
            <input type="hidden" name="employeeId" value={employeeId} />
            <NativeSelect name="status" defaultValue={document.status} className="h-7 w-40 text-xs">
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" variant="outline" size="xs" disabled={pending}>
              {pending ? "…" : "Save"}
            </Button>
          </form>
        ) : (
          <StatusBadge status={document.status} />
        )}
      </div>
      {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}

      {/* Downloading/uploading on the employee's behalf is HR-only here —
          these can be PAN/Aadhaar/bank proof (PRD §7/§30 restricted
          fields), so this stays behind the same `editable` gate as status
          changes, not shown to MANAGEMENT. */}
      {editable && (
        <div className="mt-2 space-y-2">
          {document.fileName && (
            <a
              href={`/api/documents/${document.id}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
            >
              <Paperclip className="size-3" />
              {document.fileName}
            </a>
          )}
          <UploadDocumentForm documentId={document.id} />

          {/* Who uploaded/viewed this document, and when (PRD §7/§30 —
              these can be PAN/Aadhaar/bank proof, so this trail is
              HR-only, same gate as everything else in this block). */}
          <details className="rounded-md border text-xs">
            <summary className="cursor-pointer select-none px-2 py-1.5 text-muted-foreground hover:text-foreground">
              Access history {history && history.length > 0 ? `(${history.length})` : ""}
            </summary>
            <div className="border-t px-2 py-1.5">
              {history && history.length > 0 ? (
                <ul className="flex flex-col gap-1">
                  {history.map((h) => (
                    <li key={h.id} className="text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {h.action === "UPLOADED" ? "Uploaded" : "Viewed"}
                      </span>{" "}
                      by {h.actorLabel} ·{" "}
                      {new Date(h.occurredAt).toLocaleString(undefined, { timeZone: "UTC" })} UTC
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">No recorded access yet.</p>
              )}
            </div>
          </details>
        </div>
      )}
    </li>
  );
}
