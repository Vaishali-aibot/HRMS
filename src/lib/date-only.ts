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
