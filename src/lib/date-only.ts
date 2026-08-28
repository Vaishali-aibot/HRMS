// Shared helpers for the UTC-midnight "date only" convention used by
// AttendanceRecord.date/Employee.dateOfJoining — see the schema comments.

export function todayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function todayUTCString(): string {
  return todayUTC().toISOString().slice(0, 10);
}

export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Calendar days inclusive of both ends — doesn't exclude weekends/holidays.
 * A reasonable MVP scope cut; see README "Known items to revisit".
 */
export function inclusiveDayCount(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000)) + 1;
}

/** Every UTC-midnight date from `start` to `end`, inclusive of both ends. */
export function eachDateInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Adds `months` calendar months to `date`, clamping to the last valid day
 * of the target month when the original day-of-month doesn't exist there
 * (Jan 31 + 3 months -> Apr 30, not May 1) — matching Postgres's
 * `date + interval 'N months'` semantics, NOT plain `Date.setUTCMonth`
 * (which overflows into the next month instead of clamping). Use this
 * anywhere "N months from date X" needs to agree with a SQL migration
 * computing the same thing, e.g. probationEndDate.
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const targetMonthFirst = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(targetMonthFirst.getUTCFullYear(), targetMonthFirst.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(date.getUTCDate(), daysInTargetMonth);
  return new Date(Date.UTC(targetMonthFirst.getUTCFullYear(), targetMonthFirst.getUTCMonth(), clampedDay));
}
