import { prisma } from "@/lib/prisma";
import type { AppRole } from "@/types/next-auth";

/**
 * Wipes every table in the test database (except Prisma's own migration
 * history) and resets identity sequences. Call this in a `beforeEach` so
 * every integration test starts from a guaranteed-empty, known state —
 * simpler and more robust than tracking exactly what each test created and
 * deleting only that. NEVER call this against anything but a disposable
 * test database (see vitest.integration.setup.mts's DATABASE_URL check —
 * it only confirms the var is *set*, not that it's safe, so this is
 * intentionally only ever invoked from integration test files, never
 * app code).
 */
export async function resetDb() {
  const tables = await prisma.$queryRawUnsafe<{ tablename: string }[]>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations')`
  );
  const names = tables.map((t) => `"${t.tablename}"`).join(", ");
  if (names) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
  }
}

let counter = 0;
/** Unique-per-call suffix so parallel test cases within a file never
 * collide on employeeCode/email unique constraints. */
function unique() {
  counter += 1;
  return `${Date.now()}-${counter}`;
}

/**
 * Creates a linked User+Employee pair for a test, with sensible defaults
 * for every field the schema requires. Returns both records plus a ready-
 * to-use `session` object shaped like what `auth()` returns — pass it
 * straight to the mocked `auth` (see resignation.integration.test.ts for
 * the pattern).
 */
export async function createTestEmployee(overrides?: {
  role?: AppRole;
  reportingManagerId?: string | null;
  status?: string;
  fullName?: string;
}) {
  const id = unique();
  const user = await prisma.user.create({
    data: {
      email: `test-${id}@example.com`,
      name: overrides?.fullName ?? `Test User ${id}`,
      role: overrides?.role ?? "EMPLOYEE",
    },
  });
  const employee = await prisma.employee.create({
    data: {
      employeeCode: `TEST-${id}`,
      userId: user.id,
      fullName: overrides?.fullName ?? `Test User ${id}`,
      dateOfJoining: new Date("2026-01-01"),
      department: "Engineering",
      designation: "Software Engineer",
      reportingManagerId: overrides?.reportingManagerId ?? null,
      status: (overrides?.status as never) ?? "CONFIRMED",
    },
  });
  return {
    user,
    employee,
    session: { user: { id: user.id, role: user.role as AppRole } },
  };
}
