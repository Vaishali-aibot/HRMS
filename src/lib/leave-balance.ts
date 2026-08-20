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
 * Returns the employee's balance for a leave type/year, creating it if it
 * doesn't exist yet. This is what makes leave "just work" across a year
 * boundary without a separate rollover step.
 *
 * If `leaveType.carryForwardLimit > 0`, up to that many unused days from
 * the *previous* year's balance are added to this year's `allocated` —
 * computed once, at creation time, from whatever the previous year's
 * balance looked like then. Editing carryForwardLimit later only affects
 * balances not yet created; it never retroactively changes one that
 * already exists.
 */
export async function ensureLeaveBalance(
  tx: Prisma.TransactionClient,
  employeeId: string,
  leaveType: { id: string; annualDays: number; carryForwardLimit: number },
  year: number
) {
  let carriedForward = 0;
  if (leaveType.carryForwardLimit > 0) {
    const previousYearBalance = await tx.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId: leaveType.id, year: year - 1 },
      },
    });
    if (previousYearBalance) {
      const unused = previousYearBalance.allocated - previousYearBalance.used;
      carriedForward = Math.min(Math.max(unused, 0), leaveType.carryForwardLimit);
    }
  }

  return tx.leaveBalance.upsert({
    where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId: leaveType.id, year } },
    update: {},
    create: {
      employeeId,
      leaveTypeId: leaveType.id,
      year,
      allocated: leaveType.annualDays + carriedForward,
      used: 0,
    },
  });
}
