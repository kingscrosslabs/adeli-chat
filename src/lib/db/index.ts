import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

// One pool per process, kept across dev hot reloads.
const globalForDb = globalThis as unknown as { adeliChatDb?: Database };

export function db(): Database {
  if (globalForDb.adeliChatDb) return globalForDb.adeliChatDb;
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_URL is not set on this server. Add it to .env.local and restart.");
  globalForDb.adeliChatDb = drizzle(new Pool({ connectionString }), { schema });
  return globalForDb.adeliChatDb;
}

export { schema };
