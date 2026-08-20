import type { Prisma } from "@/generated/prisma/client";

/**
 * Seeded once, lazily, the first time they're needed (at employee creation,
 * and again defensively wherever a balance is read/consumed — see
 * ensureLeaveBalance below) via `createMany({ skipDuplicates: true })` on
 * the unique `name`, so calling this repeatedly is always safe.
 *
 * HR can't configure additional leave types via the UI yet — see README
 * "Known items to revisit".
 */
export const DEFAULT_LEAVE_TYPES = [
  { name: "Annual Leave", annualDays: 18 },
  { name: "Sick Leave", annualDays: 10 },
  { name: "Casual Leave", annualDays: 7 },
];

/**
 * Returns the employee's balance for a leave type/year, creating it at the
 * type's default `annualDays` if it doesn't exist yet. This is what makes
 * leave "just work" across a year boundary without a separate rollover
 * step — every employee's balance resets to the flat default each year
 * (no carry-forward; see the schema comment on LeaveBalance).
 */
export async function ensureLeaveBalance(
  tx: Prisma.TransactionClient,
  employeeId: string,
  leaveTypeId: string,
  annualDays: number,
  year: number
) {
  return tx.leaveBalance.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year } },
    update: {},
    create: { employeeId, leaveTypeId, year, allocated: annualDays, used: 0 },
  });
}
