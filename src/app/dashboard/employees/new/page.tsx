"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { createEmployee, type CreateEmployeeState } from "@/lib/actions/employee";

const initialState: CreateEmployeeState = { ok: false };

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "rounded-md border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20";

export default function NewEmployeePage() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createEmployee, initialState);

  useEffect(() => {
    if (state.ok) {
      router.push("/dashboard/employees");
    }
  }, [state.ok, router]);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold">Add employee</h1>
      <p className="mt-1 text-sm text-black/60 dark:text-white/60">
        Creates the Employee Master record and starts the lifecycle at{" "}
        <code>PRE_BOARDING</code>. Compensation and statutory details are
        entered separately once access-restricted fields are wired up.
      </p>

      <form action={formAction} className="mt-6 flex flex-col gap-4">
        <Field label="Full name">
          <input name="fullName" required className={inputClass} />
        </Field>
        <Field label="Personal email">
          <input name="personalEmail" type="email" className={inputClass} />
        </Field>
        <Field label="Date of joining">
          <input name="dateOfJoining" type="date" required className={inputClass} />
        </Field>
        <Field label="Department">
          <input name="department" required className={inputClass} />
        </Field>
        <Field label="Designation">
          <input name="designation" required className={inputClass} />
        </Field>
        <Field label="Location">
          <input name="location" className={inputClass} />
        </Field>
        <Field label="Employment type">
          <select name="employmentType" defaultValue="FULL_TIME" className={inputClass}>
            <option value="FULL_TIME">Full-time</option>
            <option value="PART_TIME">Part-time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Intern</option>
          </select>
        </Field>
        <Field label="Work mode">
          <select name="workMode" defaultValue="ON_SITE" className={inputClass}>
            <option value="ON_SITE">On-site</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
          </select>
        </Field>
        <Field label="Reporting manager (employee ID, optional)">
          <input name="reportingManagerId" className={inputClass} />
        </Field>

        {state.error && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {pending ? "Saving…" : "Create employee"}
        </button>
      </form>
    </div>
  );
}
