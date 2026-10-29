import "server-only";

import { mkdirSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePostgres } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

const migrationsFolder = path.join(process.cwd(), "drizzle");

/**
 * Postgres when `DATABASE_URL` is set. Otherwise PGlite, an in-process
 * Postgres stored in `./.data/pglite` (in memory under tests), so the demo
 * runs with no database to install. Both apply the same migrations.
 */
function open(): { db: Database; ready: Promise<void> } {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (connectionString) {
    const db = drizzlePostgres(new Pool({ connectionString }), { schema });
    return { db, ready: migratePostgres(db, { migrationsFolder }) };
  }
  const dataDir = process.env.NODE_ENV === "test" ? undefined : path.join(process.cwd(), ".data", "pglite");
  // PGlite creates its own folder but not the parents.
  if (dataDir) mkdirSync(path.dirname(dataDir), { recursive: true });
  const db = drizzlePglite(new PGlite(dataDir), { schema });
  return { db, ready: migratePglite(db, { migrationsFolder }) };
}

// One database per process, kept across dev hot reloads.
const globalForDb = globalThis as unknown as { adeliChatDb?: ReturnType<typeof open> };

function instance() {
  globalForDb.adeliChatDb ??= open();
  return globalForDb.adeliChatDb;
}

export function db(): Database {
  return instance().db;
}

/** Applies pending migrations. Awaited once at startup (`src/instrumentation.ts`). */
export function migrateDatabase(): Promise<void> {
  return instance().ready;
}

export { schema };
