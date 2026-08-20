"use client";

import { useActionState } from "react";

import { updateEmployee, type UpdateEmployeeState } from "@/lib/actions/employee-detail";

const initialState: UpdateEmployeeState = {};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

type PotentialManager = { id: string; employeeCode: string; fullName: string };

export function EditEmployeeForm({
  employee,
  potentialManagers,
}: {
  employee: {
    id: string;
    fullName: string;
    personalEmail: string | null;
    department: string;
    designation: string;
    location: string | null;
    employmentType: string;
    workMode: string;
    reportingManagerId: string | null;
  };
  potentialManagers: PotentialManager[];
}) {
  const [state, formAction, pending] = useActionState(updateEmployee, initialState);

  return (
    <form
      action={formAction}
      className="rounded-xl border border-black/10 p-4 dark:border-white/15"
    >
      <h2 className="text-sm font-semibold">Employee details</h2>
      <input type="hidden" name="employeeId" value={employee.id} />

      <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input name="fullName" defaultValue={employee.fullName} required className={inputClass} />
        </Field>
        <Field label="Personal email">
          <input
            name="personalEmail"
            type="email"
            defaultValue={employee.personalEmail ?? ""}
            className={inputClass}
          />
        </Field>
        <Field label="Department">
          <input name="department" defaultValue={employee.department} required className={inputClass} />
        </Field>
        <Field label="Designation">
          <input name="designation" defaultValue={employee.designation} required className={inputClass} />
        </Field>
        <Field label="Location">
          <input name="location" defaultValue={employee.location ?? ""} className={inputClass} />
        </Field>
        <Field label="Employment type">
          <select name="employmentType" defaultValue={employee.employmentType} className={inputClass}>
            <option value="FULL_TIME">Full-time</option>
            <option value="PART_TIME">Part-time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Intern</option>
          </select>
        </Field>
        <Field label="Work mode">
          <select name="workMode" defaultValue={employee.workMode} className={inputClass}>
            <option value="ON_SITE">On-site</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </Field>
        <Field label="Reporting manager">
          <select
            name="reportingManagerId"
            defaultValue={employee.reportingManagerId ?? ""}
            className={inputClass}
          >
            <option value="">— None —</option>
            {potentialManagers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.employeeCode} — {m.fullName}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {state.error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-4 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {pending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
