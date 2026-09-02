"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { markOwnAttendanceToday, type MarkAttendanceState } from "@/lib/actions/attendance";

const initialState: MarkAttendanceState = {};

const STATUSES = ["PRESENT", "WORK_FROM_HOME", "HALF_DAY"] as const;

export function SelfMarkForm() {
  const [state, formAction, pending] = useActionState(markOwnAttendanceToday, initialState);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <NativeSelect name="status" defaultValue="PRESENT" className="w-40">
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replaceAll("_", " ")}
          </option>
        ))}
      </NativeSelect>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Check in for today"}
      </Button>
      {state.error && <p className="w-full text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
