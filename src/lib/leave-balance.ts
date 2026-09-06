import type { Prisma } from "@/generated/prisma/client";

/**
 * Seeded once, lazily, the first time they're needed (at employee creation,
 * and again defensively wherever a balance is read/consumed — see
 * ensureLeaveBalance below) via `createMany({ skipDuplicates: true })` on
 * the unique `name`, so calling this repeatedly is always safe.
 *
 * HR configures/adds more via /dashboard/leave-types. The 3 actual defaults
 * for an existing install were set by the
 * 20260824090100_leave_wfh_unification migration, not this constant — this
 * only matters for a brand-new database that never ran that migration's
 * data-fixup step (fresh installs never have that problem either way,
 * since the migration always runs on `prisma migrate deploy`).
 */
export const DEFAULT_LEAVE_TYPES = [
  { name: "Sick Leave", annualDays: 5, accrualMethod: "QUARTERLY" as const },
  { name: "Earned Leave", annualDays: 10, accrualMethod: "QUARTERLY" as const },
  // WFH: monthlyCap replaces the annual pool entirely — annualDays is unused
  // for this type (see the schema comment on LeaveType.monthlyCap).
  { name: "WFH", annualDays: 0, monthlyCap: 2, marksAttendanceAsWFH: true },
];

/**
 * How many of a MONTHLY-accrual type's 12 monthly installments have come
 * due for `year`, as of right now. A past year has all 12; a future year
 * has none yet; the current year has however many months have started
 * (January counts as 1, not 0, since that installment is due immediately).
 */
function monthsElapsedInclusive(year: number): number {
  const now = new Date();
  if (now.getUTCFullYear() > year) return 12;
  if (now.getUTCFullYear() < year) return 0;
  return now.getUTCMonth() + 1;
}

/** Same idea as monthsElapsedInclusive, but by quarter (1-4) instead of month. */
function quartersElapsedInclusive(year: number): number {
  const now = new Date();
  if (now.getUTCFullYear() > year) return 4;
  if (now.getUTCFullYear() < year) return 0;
  return Math.floor(now.getUTCMonth() / 3) + 1;
}

const QUARTER_MONTH_LABELS = ["Jan–Mar", "Apr–Jun", "Jul–Sep", "Oct–Dec"];

/** "Jul–Sep 2026"-style label for the quarter containing `date`. */
export function quarterLabel(date: Date): string {
  const quarterIndex = Math.floor(date.getUTCMonth() / 3);
  return `${QUARTER_MONTH_LABELS[quarterIndex]} ${date.getUTCFullYear()}`;
}

/**
 * Returns the employee's balance for a leave type/year, creating it if it
 * doesn't exist yet. This is what makes leave "just work" across a year
 * boundary without a separate rollover step.
 *
 * If `leaveType.carryForwardLimit > 0`, up to that many unused days from
 * the *previous* year's balance are added to this year's `allocated` —
 * recomputed from whatever the previous year's balance looks like right
 * now, every time this runs (not just once at creation) — see the ANNUAL
 * vs MONTHLY handling below for why that recomputation matters.
 *
 * For an `ANNUAL` leave type, `allocated` is the full `annualDays` up
 * front, same as always. For a `MONTHLY` type, `allocated` is
 * `annualDays / 12` times however many months have elapsed so far this
 * year — and unlike ANNUAL, this function *ratchets it up* on an existing
 * balance too (never down), so simply calling this again next month is
 * what makes the balance grow. No cron job needed: every place that reads
 * or spends a balance already calls this first.
 */
export async function ensureLeaveBalance(
  tx: Prisma.TransactionClient,
  employeeId: string,
  leaveType: { id: string; annualDays: number; carryForwardLimit: number; accrualMethod: string },
  year: number
) {
  let carriedForward = 0;
  if (leaveType.carryForwardLimit > 0) {
    const previousYearBalance = await tx.leaveBalance.findUnique({
      where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: leaveType.id, year: year - 1 } },
    });
    if (previousYearBalance) {
      // Already-encashed days are spent — they don't also carry forward.
      const unused =
        previousYearBalance.allocated - previousYearBalance.used - previousYearBalance.encashed;
      carriedForward = Math.min(Math.max(unused, 0), leaveType.carryForwardLimit);
    }
  }

  const accruedBase =
    leaveType.accrualMethod === "MONTHLY"
      ? (leaveType.annualDays / 12) * monthsElapsedInclusive(year)
      : leaveType.accrualMethod === "QUARTERLY"
        ? (leaveType.annualDays / 4) * quartersElapsedInclusive(year)
        : leaveType.annualDays;
  const target = accruedBase + carriedForward;

  const existing = await tx.leaveBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: leaveType.id, year } },
  });

  if (existing) {
    if (existing.allocated < target) {
      return tx.leaveBalance.update({ where: { id: existing.id }, data: { allocated: target } });
    }
    return existing;
  }

  return tx.leaveBalance.create({
    data: { employeeId, leaveTypeId: leaveType.id, year, allocated: target, used: 0 },
  });
}

/**
 * The one formula for "how much of this pool is left" — was previously
 * re-typed independently at every call site (applyForLeave,
 * decideLeaveRequest, the Leave page, the dashboard, the assistant),
 * which is how the dashboard/assistant balance-staleness bugs happened in
 * the first place. Use this (or getRemainingForLeaveType below) instead
 * of writing `allocated - used - encashed` again.
 */
export function remainingFromBalance(balance: {
  allocated: number;
  used: number;
  encashed: number;
}): number {
  return balance.allocated - balance.used - balance.encashed;
}

/**
 * "How many days of this leave type does this employee have left, right
 * now" — the single function every *read-only, single-employee* caller
 * (Leave page, dashboard, the assistant) should call, so they all agree
 * with each other. Branches on monthlyCap internally: a monthlyCap type
 * (WFH) has no LeaveBalance row, so its remaining is computed fresh from
 * approved requests (getMonthlyCapRemaining); anything else goes through
 * ensureLeaveBalance first so the figure is ratcheted up to date before
 * being read, not whatever it was last left at.
 *
 * Takes a TransactionClient (like ensureLeaveBalance) since the
 * non-monthlyCap branch can write — callers should invoke this inside
 * `prisma.$transaction((tx) => ...)`.
 *
 * Not used by applyForLeave/decideLeaveRequest — those need the raw
 * LeaveBalance row (to update `used`) for the non-monthlyCap branch, not
 * just the derived remaining figure, so they call ensureLeaveBalance +
 * remainingFromBalance directly instead.
 */
export async function getRemainingForLeaveType(
  client: Prisma.TransactionClient,
  employeeId: string,
  leaveType: {
    id: string;
    annualDays: number;
    carryForwardLimit: number;
    accrualMethod: string;
    monthlyCap: number | null;
  },
  referenceDate: Date
): Promise<number> {
  if (leaveType.monthlyCap != null) {
    return getMonthlyCapRemaining(client, employeeId, leaveType.id, leaveType.monthlyCap, referenceDate);
  }
  const year = referenceDate.getUTCFullYear();
  const balance = await ensureLeaveBalance(client, employeeId, leaveType, year);
  return remainingFromBalance(balance);
}

/**
 * Read-only version of ensureLeaveBalance's accrual math (annualDays ×
 * elapsed-fraction), without the carriedForward lookup or the ratchet-up
 * write. `carriedForward` needs a per-employee DB read, so this
 * necessarily ignores it — a no-op simplification today since every
 * seeded leave type has carryForwardLimit 0 (see DEFAULT_LEAVE_TYPES); if
 * that ever changes, this will understate accrual for employees who
 * actually carried days forward, same kind of disclosed simplification as
 * elsewhere in this file.
 *
 * Meant for aggregate views (Reports) where the accrued amount is
 * identical for every employee of a given type/year (absent carry-
 * forward) — multiply this by a headcount instead of calling
 * ensureLeaveBalance once per employee.
 */
export function computeAccruedBase(
  leaveType: { annualDays: number; accrualMethod: string },
  year: number
): number {
  return leaveType.accrualMethod === "MONTHLY"
    ? (leaveType.annualDays / 12) * monthsElapsedInclusive(year)
    : leaveType.accrualMethod === "QUARTERLY"
      ? (leaveType.annualDays / 4) * quartersElapsedInclusive(year)
      : leaveType.annualDays;
}

/**
 * How many days of a monthlyCap-style leave type (see the
 * LeaveType.monthlyCap schema comment — currently just WFH) remain in the
 * calendar month containing `referenceDate`, given approved requests of
 * that type so far. Unlike ensureLeaveBalance's annual pool, this is never
 * persisted as a LeaveBalance row — it's always computed fresh from
 * LeaveRequest, so there's nothing to ratchet up or carry forward.
 *
 * A request spanning a month boundary is attributed entirely to its start
 * date's month — same disclosed simplification as applyForLeave's
 * year-boundary handling (src/lib/actions/leave.ts).
 */
export async function getMonthlyCapRemaining(
  client: Prisma.TransactionClient,
  employeeId: string,
  leaveTypeId: string,
  monthlyCap: number,
  referenceDate: Date
): Promise<number> {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 1));
  const result = await client.leaveRequest.aggregate({
    where: {
      employeeId,
      leaveTypeId,
      status: "APPROVED",
      startDate: { gte: monthStart, lt: monthEnd },
    },
    _sum: { days: true },
  });
  return monthlyCap - (result._sum.days ?? 0);
}
