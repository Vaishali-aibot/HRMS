-- The default probation length used to be a flat 90-day offset from
-- dateOfJoining, meant as a stand-in for "3 months" but not calendar-
-- accurate — it lands 1-3 days short of the true 3-month mark depending on
-- which months are spanned (src/lib/actions/employee.ts now adds 3
-- calendar months instead). Recompute every existing employee's
-- probationEndDate to match, so records created before this fix aren't
-- left with the old, slightly-off date.
--
-- This intentionally does not try to distinguish "used the 90-day default"
-- from "HR typed 90 into the days field on purpose" — every employee
-- created so far shows exactly a 90-day gap, so in practice there's
-- nothing to lose by recomputing unconditionally.
UPDATE "Employee"
SET "probationEndDate" = "dateOfJoining" + INTERVAL '3 months'
WHERE "probationEndDate" IS NOT NULL;
