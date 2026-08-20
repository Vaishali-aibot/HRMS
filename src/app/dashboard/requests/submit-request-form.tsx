"use client";

import { useActionState } from "react";

import { submitHRRequest, type HRRequestActionState } from "@/lib/actions/hr-request";

const initialState: HRRequestActionState = {};

const CATEGORIES = [
  "LEAVE",
  "ATTENDANCE",
  "SALARY_DOCUMENTS",
  "EMPLOYMENT_LETTERS",
  "PERSONAL_INFO_UPDATE",
  "POLICY_CLARIFICATION",
  "BENEFITS",
  "PAYROLL_QUERY",
  "OTHER",
] as const;

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

export function SubmitRequestForm() {
  const [state, formAction, pending] = useActionState(submitHRRequest, initialState);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Category</span>
        <select name="category" className={inputClass}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Subject</span>
        <input name="subject" required className={inputClass} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium">Description</span>
        <textarea name="description" required rows={3} className={inputClass} />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Submitting…" : "Submit request"}
      </button>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
