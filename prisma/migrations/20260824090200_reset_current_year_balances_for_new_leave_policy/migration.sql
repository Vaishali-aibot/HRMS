-- The previous migration (leave_wfh_unification) changed Earned Leave and
-- Sick Leave's day counts and accrual method, but per ensureLeaveBalance's
-- own "never rewrite a balance that already exists" rule
-- (src/lib/leave-balance.ts), any employee's *current year* LeaveBalance
-- row for those types is still sitting at whatever `allocated` was
-- ratcheted up to under the old config (e.g. the old annual/monthly
-- figures), not the new quarterly-prorated ones — and since
-- ensureLeaveBalance only ever ratchets `allocated` UP, never down, simply
-- reading/applying again wouldn't correct an inflated stale value either.
--
-- Recompute `allocated` in place to what the new QUARTERLY formula would
-- give as of right now (quarters elapsed this year × annualDays/4) —
-- exactly what ensureLeaveBalance itself computes — while leaving `used`
-- and `encashed` untouched, so nobody's already-taken leave silently comes
-- back. Earlier years' rows (history) are untouched.
UPDATE "LeaveBalance" lb
SET allocated = (lt."annualDays" / 4.0)
  * (FLOOR((EXTRACT(MONTH FROM CURRENT_DATE)::int - 1) / 3) + 1)
FROM "LeaveType" lt
WHERE lb."leaveTypeId" = lt.id
  AND lt.name IN ('Earned Leave', 'Sick Leave')
  AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)::int;
