import { defineConfig } from "vitest/config";

// Pure unit tests only — no Prisma/DB, no React rendering. Deliberately
// excludes *.integration.test.ts (see vitest.integration.config.mts) so
// `npm test` stays fast and safe to run with zero setup, for anyone
// without a test database configured.
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});
