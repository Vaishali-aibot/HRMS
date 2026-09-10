-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


-- Positioned explicitly (BEFORE EXPERIENCE_LETTER) so ORDER BY type ASC
-- matches the schema's declared order, not just append-at-the-end.
ALTER TYPE "ExitChecklistItemType" ADD VALUE 'SEPARATION_LETTER_SENT' BEFORE 'EXPERIENCE_LETTER';
ALTER TYPE "ExitChecklistItemType" ADD VALUE 'SEPARATION_LETTER_RECEIVED' BEFORE 'EXPERIENCE_LETTER';
