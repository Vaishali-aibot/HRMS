-- Drop COMMUNICATION_TOOL_ACCESS, VPN_ACCESS, APPLICATION_ACCESS,
-- SOFTWARE_INSTALLATION, and SECURITY_ACCESS from the IT onboarding
-- checklist — not required per HR. Only LAPTOP_ALLOCATION, EMAIL_CREATION,
-- and HRMS_ACCESS remain.
--
-- Any employee's IT checklist that already has a row of one of these types
-- has that row removed first — Postgres can't cast an existing value to a
-- narrowed enum that no longer contains it, so the ALTER COLUMN below would
-- otherwise fail on any employee whose onboarding already seeded one.
BEGIN;

DELETE FROM "ITOnboardingTask"
WHERE "type" IN (
  'COMMUNICATION_TOOL_ACCESS',
  'VPN_ACCESS',
  'APPLICATION_ACCESS',
  'SOFTWARE_INSTALLATION',
  'SECURITY_ACCESS'
);

CREATE TYPE "ITTaskType_new" AS ENUM ('LAPTOP_ALLOCATION', 'EMAIL_CREATION', 'HRMS_ACCESS');
ALTER TABLE "ITOnboardingTask" ALTER COLUMN "type" TYPE "ITTaskType_new" USING ("type"::text::"ITTaskType_new");
ALTER TYPE "ITTaskType" RENAME TO "ITTaskType_old";
ALTER TYPE "ITTaskType_new" RENAME TO "ITTaskType";
DROP TYPE "public"."ITTaskType_old";

COMMIT;
