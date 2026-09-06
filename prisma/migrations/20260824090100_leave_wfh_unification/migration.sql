-- Leave module rework: 3 leave types (Sick Leave, Earned Leave, WFH),
-- Sick/Earned move to quarterly accrual, WFH becomes a monthly-capped leave
-- type instead of its own separate request/policy system. See the comments
-- on LeaveType.monthlyCap/marksAttendanceAsWFH in schema.prisma.
--
-- WFHRequest/WFHPolicy/LeaveEncashmentRequest tables are intentionally left
-- in place (unused going forward) rather than dropped — no new rows will be
-- written to them, but existing data stays intact and reversible.

ALTER TABLE "LeaveType" ADD COLUMN "monthlyCap" DOUBLE PRECISION;
ALTER TABLE "LeaveType" ADD COLUMN "marksAttendanceAsWFH" BOOLEAN NOT NULL DEFAULT false;

-- Reuse the existing "Annual Leave" row (rename in place) rather than
-- delete+recreate, so any LeaveBalance/LeaveRequest rows already pointing
-- at it stay valid.
UPDATE "LeaveType"
SET name = 'Earned Leave', "annualDays" = 10, "accrualMethod" = 'QUARTERLY'::"LeaveAccrualMethod"
WHERE name = 'Annual Leave';

UPDATE "LeaveType"
SET "annualDays" = 5, "accrualMethod" = 'QUARTERLY'::"LeaveAccrualMethod"
WHERE name = 'Sick Leave';

-- No longer offered — deactivate rather than delete so historical
-- balances/requests referencing it stay valid.
UPDATE "LeaveType" SET "isActive" = false WHERE name = 'Casual Leave';

-- WFH: monthly cap, not an annual pool. annualDays/accrualMethod are
-- unused for a monthlyCap type (see schema comment) but kept non-null/valid
-- to satisfy the column constraints.
INSERT INTO "LeaveType"
  (id, name, "annualDays", "carryForwardLimit", "accrualMethod", "monthlyCap", "marksAttendanceAsWFH", "isActive", "createdAt")
SELECT gen_random_uuid()::text, 'WFH', 0, 0, 'ANNUAL'::"LeaveAccrualMethod", 2, true, true, now()
WHERE NOT EXISTS (SELECT 1 FROM "LeaveType" WHERE name = 'WFH');

-- Carry historical WFH requests over into the unified LeaveRequest table
-- (same id, so re-running this migration a second time is a no-op) so they
-- keep showing up in "My requests" instead of silently disappearing.
INSERT INTO "LeaveRequest"
  (id, "employeeId", "leaveTypeId", "startDate", "endDate", days, reason, status, "approverId", "decidedAt", "decisionReason", "createdAt")
SELECT
  w.id,
  w."employeeId",
  (SELECT id FROM "LeaveType" WHERE name = 'WFH'),
  w."startDate",
  w."endDate",
  (w."endDate"::date - w."startDate"::date + 1)::double precision,
  w.reason,
  w.status::text::"LeaveRequestStatus",
  w."approverId",
  w."decidedAt",
  w."decisionReason",
  w."createdAt"
FROM "WFHRequest" w
WHERE NOT EXISTS (SELECT 1 FROM "LeaveRequest" lr WHERE lr.id = w.id);
