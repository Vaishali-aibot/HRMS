-- Give WFH month-to-month carry-forward: convert it from a monthlyCap
-- type (no persisted balance at all, resets to a fresh 2 every month) to
-- a MONTHLY-accrual type (2/month = annualDays 24, LeaveBalance-backed) —
-- the exact mechanism every other leave type already uses via
-- ensureLeaveBalance. Unused days now carry forward within the year
-- because `allocated` only ratchets up and `used` only grows when spent;
-- it still resets to a fresh pool each January (carryForwardLimit stays 0
-- — no cross-year carry, since only month-to-month was asked for).
--
-- marksAttendanceAsWFH-gated behavior (attendance marking on approval,
-- eligibility/yearly-cap checks) is untouched by this — decideLeaveRequest
-- and applyForLeave key off that flag directly, never off monthlyCap, so
-- nothing else about WFH changes.
UPDATE "LeaveType"
SET "monthlyCap" = NULL,
    "accrualMethod" = 'MONTHLY'::"LeaveAccrualMethod",
    "annualDays" = 24
WHERE name = 'WFH';

-- Backfill this year's LeaveBalance for every employee, so historical WFH
-- usage (previously tracked only via LeaveRequest sums against a monthly
-- window, never a persisted balance) carries forward correctly instead of
-- everyone starting fresh at "0 used" the moment this switch takes effect.
-- Idempotent: re-running is a no-op wherever a balance row already exists.
INSERT INTO "LeaveBalance" (id, "employeeId", "leaveTypeId", year, allocated, used, encashed)
SELECT
  gen_random_uuid()::text,
  e.id,
  wfh.id,
  EXTRACT(YEAR FROM now())::int,
  2 * EXTRACT(MONTH FROM now())::float,
  COALESCE((
    SELECT SUM(lr.days) FROM "LeaveRequest" lr
    WHERE lr."employeeId" = e.id
      AND lr."leaveTypeId" = wfh.id
      AND lr.status = 'APPROVED'
      AND EXTRACT(YEAR FROM lr."startDate") = EXTRACT(YEAR FROM now())
  ), 0),
  0
FROM "Employee" e
CROSS JOIN (SELECT id FROM "LeaveType" WHERE name = 'WFH') wfh
WHERE NOT EXISTS (
  SELECT 1 FROM "LeaveBalance" lb
  WHERE lb."employeeId" = e.id
    AND lb."leaveTypeId" = wfh.id
    AND lb.year = EXTRACT(YEAR FROM now())::int
);
