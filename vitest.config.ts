import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tanstackStart(), viteReact()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Never the dev database: the tests truncate tables, and a running dev
    // server's sync loop deadlocks against the truncate.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        "postgres://kitchen_sync:kitchen_sync@localhost:5433/kitchen_sync_test",
    },
  },
});
