-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "Holiday_date_idx" ON "Holiday"("date");

-- Seed the 2026 holiday calendar HR provided. ON CONFLICT DO NOTHING keeps
-- this safe to re-run and safe if someone already added one of these dates
-- by hand before this migration ran.
INSERT INTO "Holiday" (id, date, name) VALUES
  (gen_random_uuid()::text, '2026-10-02T00:00:00Z', 'Mahatma Gandhi''s Birthday'),
  (gen_random_uuid()::text, '2026-10-20T00:00:00Z', 'Dussehra'),
  (gen_random_uuid()::text, '2026-11-01T00:00:00Z', 'Kannada Rajyotsava'),
  (gen_random_uuid()::text, '2026-11-09T00:00:00Z', 'Diwali'),
  (gen_random_uuid()::text, '2026-12-25T00:00:00Z', 'Christmas Day')
ON CONFLICT (date) DO NOTHING;
