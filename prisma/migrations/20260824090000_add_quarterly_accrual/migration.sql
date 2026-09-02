-- Add QUARTERLY as a leave accrual method (alongside existing ANNUAL/MONTHLY).
-- This has to be its own migration, applied (and committed) before anything
-- references the new value — Postgres doesn't allow a newly added enum
-- value to be used in the same transaction that added it.
ALTER TYPE "LeaveAccrualMethod" ADD VALUE 'QUARTERLY';
