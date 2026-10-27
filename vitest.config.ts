import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** A separate database on the docker-compose Postgres, so tests never touch your data. */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgres://adeli_chat:adeli_chat@localhost:35438/adeli_chat_test";

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
    globalSetup: ["./test/global-setup.ts"],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    // Database tests share one test database.
    fileParallelism: false,
  },
});
