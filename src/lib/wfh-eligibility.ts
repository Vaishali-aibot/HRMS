import type { Prisma } from "@/generated/prisma/client";

/**
 * Re-checks the org's WFH eligibility policy — employment type, location,
 * and a yearly cap — for any leave type flagged `marksAttendanceAsWFH`.
 *
 * This is the one piece of the old standalone WFH module's `WFHPolicy`
 * enforcement (formerly `checkWFHPolicy` in the now-deleted
 * src/lib/actions/wfh.ts) that's still meaningful after WFH became a leave
 * type: the *monthly* cap moved to `LeaveType.monthlyCap`
 * (getMonthlyCapRemaining), but eligibility and the yearly cap were never
 * ported over when that merge happened — this restores them. `WFHPolicy`
 * is still a singleton row (`id: "default"`), same as before.
 *
 * Called both as a courtesy check at application time and again — the
 * point that actually matters — right before approval, same two-check
 * pattern the old module used and the same one this app uses for balance
 * checks elsewhere (see applyForLeave/decideLeaveRequest).
 *
 * Returns an error message, or null if the request is allowed.
 */
export async function checkWFHEligibility(
  client: Prisma.TransactionClient,
  employee: { id: string; employmentType: string; location: string | null },
  leaveTypeId: string,
  startDate: Date,
  days: number
): Promise<string | null> {
  const policy = await client.wFHPolicy.findUnique({ where: { id: "default" } });
  if (!policy) return null;

  if (
    policy.eligibleEmploymentTypes.length > 0 &&
    !policy.eligibleEmploymentTypes.includes(employee.employmentType as never)
  ) {
    return "Your employment type isn't eligible for WFH under the current policy.";
  }

  if (policy.allowedLocations.length > 0) {
    const allowed = employee.location
      ? policy.allowedLocations.some(
          (loc) => loc.toLowerCase() === employee.location!.toLowerCase()
        )
      : false;
    if (!allowed) {
      return "WFH isn't available for your location under the current policy.";
    }
  }

  if (policy.maxDaysPerYear != null) {
    // Same year-boundary simplification as elsewhere in the leave flow —
    // attributed entirely to the request's start-date year.
    const year = startDate.getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1));
    const yearEnd = new Date(Date.UTC(year + 1, 0, 1));
    const result = await client.leaveRequest.aggregate({
      where: {
        employeeId: employee.id,
        leaveTypeId,
        status: "APPROVED",
        startDate: { gte: yearStart, lt: yearEnd },
      },
      _sum: { days: true },
    });
    const usedThisYear = result._sum.days ?? 0;
    if (usedThisYear + days > policy.maxDaysPerYear) {
      return `This would exceed the yearly WFH limit of ${policy.maxDaysPerYear} day(s) (${usedThisYear} already approved this year).`;
    }
  }

  return null;
}
