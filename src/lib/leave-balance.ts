import type { Prisma } from "@/generated/prisma/client";

/**
 * Seeded once, lazily, the first time they're needed (at employee creation,
 * and again defensively wherever a balance is read/consumed — see
 * ensureLeaveBalance below) via `createMany({ skipDuplicates: true })` on
 * the unique `name`, so calling this repeatedly is always safe.
 *
 * HR configures/adds more via /dashboard/leave-types.
 */
export const DEFAULT_LEAVE_TYPES = [
  { name: "Annual Leave", annualDays: 18 },
  { name: "Sick Leave", annualDays: 10 },
  { name: "Casual Leave", annualDays: 7 },
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
