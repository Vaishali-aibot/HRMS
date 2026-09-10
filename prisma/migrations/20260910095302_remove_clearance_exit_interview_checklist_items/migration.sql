-- Drop CLEARANCE and EXIT_INTERVIEW from the exit checklist.
--
-- Any employee's checklist that already has a row of one of these types
-- has that row removed first — Postgres can't cast an existing value to a
-- narrowed enum that no longer contains it, so the ALTER COLUMN below would
-- otherwise fail on any in-progress or completed exit that has one.
BEGIN;

DELETE FROM "ExitChecklistItem" WHERE "type" IN ('CLEARANCE', 'EXIT_INTERVIEW');

CREATE TYPE "ExitChecklistItemType_new" AS ENUM ('MANAGER_CONFIRMATION', 'HR_DISCUSSION', 'KNOWLEDGE_TRANSFER', 'ASSET_RETURN', 'ACCESS_REVOCATION', 'FINAL_SETTLEMENT', 'SEPARATION_LETTER_SENT', 'SEPARATION_LETTER_RECEIVED', 'EXPERIENCE_LETTER', 'RELIEVING_LETTER');
ALTER TABLE "ExitChecklistItem" ALTER COLUMN "type" TYPE "ExitChecklistItemType_new" USING ("type"::text::"ExitChecklistItemType_new");
ALTER TYPE "ExitChecklistItemType" RENAME TO "ExitChecklistItemType_old";
ALTER TYPE "ExitChecklistItemType_new" RENAME TO "ExitChecklistItemType";
DROP TYPE "public"."ExitChecklistItemType_old";

COMMIT;
