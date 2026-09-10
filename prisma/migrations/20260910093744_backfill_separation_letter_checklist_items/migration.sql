-- Backfill: an employee already mid-exit (i.e. who already has at least
-- one ExitChecklistItem row) was seeded before SEPARATION_LETTER_SENT/
-- SEPARATION_LETTER_RECEIVED existed, so their checklist would otherwise be
-- permanently missing these two items — commenceNoticePeriod only seeds
-- once, at exit start (see prisma/schema.prisma's OnboardingDocument-style
-- comment above ExitChecklistItem, and exit.ts). New exits going forward
-- get both automatically via Object.values(ExitChecklistItemType).
--
-- Has to be a separate migration from the ALTER TYPE that added these
-- values — Postgres won't let a new enum value be used in the same
-- transaction that added it.
INSERT INTO "ExitChecklistItem" (id, "employeeId", type)
SELECT gen_random_uuid()::text, existing."employeeId", missing.type
FROM (SELECT DISTINCT "employeeId" FROM "ExitChecklistItem") existing
CROSS JOIN (
  VALUES
    ('SEPARATION_LETTER_SENT'::"ExitChecklistItemType"),
    ('SEPARATION_LETTER_RECEIVED'::"ExitChecklistItemType")
) AS missing(type)
ON CONFLICT ("employeeId", type) DO NOTHING;
