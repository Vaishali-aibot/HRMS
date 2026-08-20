"use client";

import { useActionState } from "react";

import { updateDocumentStatus, type UpdateChecklistState } from "@/lib/actions/onboarding";
import { UploadDocumentForm } from "@/components/documents/upload-document-form";

const initialState: UpdateChecklistState = {};

const STATUSES = [
  "NOT_SUBMITTED",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
  "RESUBMISSION_REQUIRED",
] as const;

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/20";

export function DocumentRow({
  document,
  employeeId,
  editable,
}: {
  document: { id: string; type: string; status: string; fileName: string | null };
  employeeId: string;
  editable: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateDocumentStatus, initialState);

  return (
    <li className="border-t border-black/10 px-3 py-2 text-sm first:border-t-0 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>{document.type.replaceAll("_", " ")}</span>
        {editable ? (
          <form action={formAction} className="flex items-center gap-2">
            <input type="hidden" name="documentId" value={document.id} />
            <input type="hidden" name="employeeId" value={employeeId} />
            <select name="status" defaultValue={document.status} className={inputClass}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md border border-black/15 px-2 py-1 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
            >
              {pending ? "…" : "Save"}
            </button>
          </form>
        ) : (
          <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">
            {document.status.replaceAll("_", " ")}
          </span>
        )}
      </div>
      {state.error && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>
      )}

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
              className="text-xs hover:underline"
            >
              📎 {document.fileName}
            </a>
          )}
          <UploadDocumentForm documentId={document.id} />
        </div>
      )}
    </li>
  );
}
