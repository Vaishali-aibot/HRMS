import { defineConfig } from "vitest/config";

// Unit tests only — no Prisma/DB, no React rendering. Server actions and
// anything that needs a database are integration-tested manually for now
// (see README); this covers the pure business logic that's caused real
// bugs before (leave accrual, date math) without the setup cost of a test
// database or Prisma mocking.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
