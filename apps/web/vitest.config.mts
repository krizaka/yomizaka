import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL(".", import.meta.url)) };
const include = ["lib/**/*.test.ts", "app/**/*.test.{ts,tsx}", "*.test.ts", "components/**/*.test.{ts,tsx}"];
// The files that share the one PostgreSQL of the run. They share its global rows too (the settings test closes the app for maintenance,
// the flows test seeds): side by side they read each other's state (503 MAINTENANCE in an unrelated file), so they run one at a time.
const database = ["**/*.integration.test.ts", "lib/applicant-consent.test.ts"];

export default defineConfig({
  test: {
    projects: [
      { resolve: { alias }, test: { name: "unit", include, exclude: database, environment: "node" } },
      { resolve: { alias }, test: { name: "database", include: database, environment: "node", fileParallelism: false } },
    ],
  },
});
