"use client";

import { useActionState } from "react";

import { giveRecognition, type RecognitionActionState } from "@/lib/actions/recognition";

const initialState: RecognitionActionState = {};

const inputClass =
  "w-full rounded-md border border-black/15 bg-transparent px-2 py-1 text-sm dark:border-white/20";

type EmployeeOption = { id: string; employeeCode: string; fullName: string };

export function GiveRecognitionForm({ employees }: { employees: EmployeeOption[] }) {
  const [state, formAction, pending] = useActionState(giveRecognition, initialState);

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">
        Recognize
        <select name="toEmployeeId" required defaultValue="" className={inputClass}>
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
        Category
        <select name="category" defaultValue="TEAMWORK" className={inputClass}>
          <option value="TEAMWORK">Teamwork</option>
          <option value="INNOVATION">Innovation</option>
          <option value="CUSTOMER_FOCUS">Customer focus</option>
          <option value="LEADERSHIP">Leadership</option>
          <option value="GOING_ABOVE_AND_BEYOND">Going above &amp; beyond</option>
          <option value="OTHER">Other</option>
        </select>
      </label>
      <label className="text-sm">
        Points (1-100)
        <input type="number" name="points" min={1} max={100} defaultValue={10} className={inputClass} />
      </label>
      <label className="text-sm sm:col-span-2">
        Message
        <textarea name="message" required rows={2} className={inputClass} />
      </label>
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-50 dark:border-white/20 dark:hover:bg-white/10"
        >
          {pending ? "Sending…" : "Give recognition"}
        </button>
      </div>
      {state.error && (
        <p className="text-xs text-red-600 sm:col-span-2 dark:text-red-400">{state.error}</p>
      )}
    </form>
  );
}
