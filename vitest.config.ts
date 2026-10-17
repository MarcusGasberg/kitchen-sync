import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { snippets } from "./src/build/snippet-plugin";

// The files that touch the test database. They truncate the same tables, so
// they run one at a time; everything else stays parallel.
const databaseTests = [
  "src/tests/sync-server.contract.postgres.test.ts",
  "src/tests/sync-server.postgres.test.ts",
  "src/tests/json-route.test.ts",
  "src/tests/migrations.postgres.test.ts",
];

export default defineConfig({
  plugins: [snippets(), tanstackStart(), viteReact()],
  test: {
    environment: "jsdom",
    setupFiles: ["src/tests/setup-dom.ts"],
    // Never the dev database: the tests truncate tables, and a running dev
    // server's sync loop deadlocks against the truncate.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://kitchen_sync:kitchen_sync@localhost:5433/kitchen_sync_test",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: databaseTests,
        },
      },
      {
        extends: true,
        test: {
          name: "database",
          include: databaseTests,
          fileParallelism: false,
        },
      },
    ],
  },
});
