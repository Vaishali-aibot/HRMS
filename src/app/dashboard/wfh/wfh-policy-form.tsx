"use client";

import { useActionState } from "react";

import { updateWFHPolicy, type WFHPolicyState } from "@/lib/actions/wfh-policy";

const initialState: WFHPolicyState = {};

const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

const EMPLOYMENT_TYPES: { value: string; label: string }[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
  { value: "INTERN", label: "Intern" },
];

export function WFHPolicyForm({
  policy,
}: {
  policy: {
    maxDaysPerMonth: number | null;
    maxDaysPerYear: number | null;
    eligibleEmploymentTypes: string[];
    allowedLocations: string[];
  };
}) {
  const [state, formAction, pending] = useActionState(updateWFHPolicy, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm">
        Max days/month (blank = no limit)
        <input
          type="number"
          name="maxDaysPerMonth"
          min={0}
          defaultValue={policy.maxDaysPerMonth ?? ""}
          className={inputClass}
        />
      </label>
      <label className="text-sm">
        Max days/year (blank = no limit)
        <input
          type="number"
          name="maxDaysPerYear"
          min={0}
          defaultValue={policy.maxDaysPerYear ?? ""}
          className={inputClass}
        />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="text-sm">Eligible employment types (none checked = everyone eligible)</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {EMPLOYMENT_TYPES.map((t) => (
            <label key={t.value} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                name={`eligible_${t.value}`}
                value="true"
                defaultChecked={policy.eligibleEmploymentTypes.includes(t.value)}
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="text-sm sm:col-span-2">
        Allowed locations, comma-separated (blank = no restriction)
        <input
          name="allowedLocations"
          defaultValue={policy.allowedLocations.join(", ")}
          placeholder="e.g. Bengaluru, Mumbai"
          className={inputClass}
        />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Saving…" : "Save policy"}
        </button>
      </div>
      {state.error && (
        <p className="text-xs text-red-600 sm:col-span-2 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
