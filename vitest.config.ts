import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // `server-only` throws outside a React Server Components build.
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // No DATABASE_URL, so every test file runs on a fresh in-memory PGlite.
    // The server's Adeli key (`test/db-helpers.ts` TEST_KEY), pointing at the fake Adeli.
    env: { DATABASE_URL: "", ADELI_API_KEY: `rk_live_${"a".repeat(43)}`, ADELI_API_BASE_URL: "http://localhost:3000" },
    setupFiles: ["./test/setup-db.ts"],
  },
});
