import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// drizzle-kit doesn't read Next's env files, so load the local one ourselves.
if (!process.env.DATABASE_URL && existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
