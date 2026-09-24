-- Backfill: every employee should have one OnboardingDocument row per
-- DocumentType, since the Documents page's upload form only ever shows for
-- a type that already has a row — there's no other way to submit
-- PAN/Aadhaar/bank proof/etc. Bulk-imported employees (createEmployeeRecord
-- called with seedITTasks: false, back when that flag was named
-- seedOnboarding and also skipped documents) never got these rows at all,
-- leaving their Documents page permanently empty. This is a general
-- anti-join over (employeeId, type), not scoped to just the imported
-- batch, so it's a safe no-op for anyone who already has all 8 rows and
-- also covers any other gap the same way.
INSERT INTO "OnboardingDocument" (id, "employeeId", type, status, "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, e.id, dt.type, 'NOT_SUBMITTED'::"DocumentStatus", now(), now()
FROM "Employee" e
CROSS JOIN (SELECT unnest(enum_range(NULL::"DocumentType")) AS type) dt
WHERE NOT EXISTS (
  SELECT 1 FROM "OnboardingDocument" od
  WHERE od."employeeId" = e.id AND od.type = dt.type
);
