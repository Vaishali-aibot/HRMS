"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { FormField } from "@/components/form-field";
import { applyForLeave, getLeaveTypeRemaining, type LeaveActionState } from "@/lib/actions/leave";
import { inclusiveDayCount } from "@/lib/date-only";

const initialState: LeaveActionState = {};

export type ApplyLeaveType = {
  id: string;
  name: string;
  /** Days left to apply for right now — annual balance, or this month's
   *  remaining cap for a monthlyCap type (see isMonthlyCap). Only accurate
   *  as of page-load ("now") — for a monthlyCap type this form re-fetches
   *  it for whichever month the user actually picks, since "this month"
   *  and "the month of the selected date" can differ. */
  remaining: number;
  isMonthlyCap: boolean;
  /** True for a leave type that requires a reason (currently: WFH). */
  reasonRequired: boolean;
};

export function ApplyLeaveForm({ leaveTypes }: { leaveTypes: ApplyLeaveType[] }) {
  const [state, formAction, pending] = useActionState(applyForLeave, initialState);
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const selected = leaveTypes.find((lt) => lt.id === leaveTypeId);

  // The `remaining` prop is only ever accurate for "now" — for a monthly-
  // capped type (WFH) that's wrong the moment the user picks a date in a
  // different month, so re-fetch it for whichever month is actually
  // selected. Non-monthlyCap types don't need this (their balance doesn't
  // vary by which date within the same year is picked). Keyed on
  // id+date rather than reset-on-change, so a stale fetch from a since-
  // abandoned selection is identified (and ignored) by key mismatch
  // instead of needing a synchronous setState in the effect body.
  const liveKey = selected?.isMonthlyCap && startDate ? `${selected.id}:${startDate}` : null;
  const [liveRemaining, setLiveRemaining] = useState<{ key: string; remaining: number } | null>(
    null
  );
  const [liveRemainingPending, startLiveRemainingTransition] = useTransition();

  useEffect(() => {
    if (!liveKey) return;
    let cancelled = false;
    startLiveRemainingTransition(async () => {
      const result = await getLeaveTypeRemaining(selected!.id, startDate);
      if (cancelled || !("remaining" in result)) return;
      setLiveRemaining({ key: liveKey, remaining: result.remaining });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);

  const effectiveRemaining =
    liveKey && liveRemaining?.key === liveKey ? liveRemaining.remaining : (selected?.remaining ?? 0);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) return 0;
    return inclusiveDayCount(start, end);
  }, [startDate, endDate]);

  const overLimit = !!selected && days > 0 && days > effectiveRemaining;
  const canSubmit = !pending && !!leaveTypeId && days > 0 && !overLimit;

  return (
    <Card>
      <form action={formAction}>
        <CardContent className="flex flex-wrap items-end gap-3">
          <FormField label="Leave type" htmlFor="leaveTypeId">
            <NativeSelect
              id="leaveTypeId"
              name="leaveTypeId"
              required
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-40"
            >
              {leaveTypes.map((lt) => (
                <option key={lt.id} value={lt.id}>
                  {lt.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Start date" htmlFor="startDate">
            <Input
              id="startDate"
              type="date"
              name="startDate"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </FormField>
          <FormField label="End date" htmlFor="endDate">
            <Input
              id="endDate"
              type="date"
              name="endDate"
              required
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </FormField>
          <FormField
            label={selected?.reasonRequired ? "Reason" : "Reason (optional)"}
            htmlFor="reason"
            className="min-w-[10rem] flex-1"
          >
            <Input id="reason" name="reason" required={selected?.reasonRequired ?? false} />
          </FormField>
          <Button type="submit" disabled={!canSubmit}>
            {pending ? "Submitting…" : "Apply"}
          </Button>

          {selected && (
            <p className="w-full text-xs text-muted-foreground">
              {liveRemainingPending
                ? "Checking balance…"
                : `${effectiveRemaining} day${effectiveRemaining === 1 ? "" : "s"} remaining${
                    selected.isMonthlyCap ? " that month" : ""
                  } for ${selected.name}`}
              {days > 0 && ` · requesting ${days} day${days === 1 ? "" : "s"}`}
            </p>
          )}
          {overLimit && (
            <p className="w-full text-sm text-destructive">
              Not enough balance — only {effectiveRemaining} day{effectiveRemaining === 1 ? "" : "s"}{" "}
              remaining{selected!.isMonthlyCap ? " that month" : ""}.
            </p>
          )}
          {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
        </CardContent>
      </form>
    </Card>
  );
}
