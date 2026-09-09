import { defineConfig } from "vitest/config";

// Server Action tests that hit a real Postgres — separate from
// vitest.config.mts's pure unit tests so `npm test` stays zero-setup.
// Needs DATABASE_URL pointing at a real, disposable test database (never
// point this at production or your local dev data — tests truncate
// tables between runs). In CI, the workflow provides this via a Postgres
// service container; locally, put it in .env.test.local (gitignored,
// same convention as .env.local) — see README "Testing".
//
// Run sequentially (fileParallelism off, one worker): tests within a
// file already isolate via unique per-test IDs, but running whole test
// *files* concurrently would let two files' cleanup (table truncation)
// race against another file's in-progress test.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    setupFiles: ["./vitest.integration.setup.mts"],
    fileParallelism: false,
    testTimeout: 15000,
  },
});
