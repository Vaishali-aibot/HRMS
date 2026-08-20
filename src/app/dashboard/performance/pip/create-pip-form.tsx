"use client";

import { useActionState } from "react";

import { createPIP, type PIPActionState } from "@/lib/actions/pip";

const initialState: PIPActionState = {};

const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

type EmployeeOption = { id: string; employeeCode: string; fullName: string };

export function CreatePIPForm({ employees }: { employees: EmployeeOption[] }) {
  const [state, formAction, pending] = useActionState(createPIP, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">
        Employee
        <select name="employeeId" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Select…
          </option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.employeeCode} — {e.fullName}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        Start date
        <input type="date" name="startDate" required className={inputClass} />
      </label>
      <label className="text-sm">
        End date
        <input type="date" name="endDate" required className={inputClass} />
      </label>
      <label className="text-sm sm:col-span-2">
        Reason
        <textarea name="reason" required rows={2} className={inputClass} />
      </label>
      <label className="text-sm sm:col-span-2">
        Improvement goals / expectations
        <textarea name="goals" required rows={3} className={inputClass} />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Starting…" : "Start PIP"}
        </button>
      </div>
      {state.error && (
        <p className="text-xs text-red-600 sm:col-span-2 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
