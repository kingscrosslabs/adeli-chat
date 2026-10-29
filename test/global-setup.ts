import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";
import type { TestProject } from "vitest/node";

/** Creates the test database if needed and applies every migration. Needs `docker compose up -d`. */
export default async function setup(project: TestProject) {
  const testDatabaseUrl = project.config.env.DATABASE_URL;
  if (!testDatabaseUrl) throw new Error("vitest.config.ts must set DATABASE_URL for tests.");
  const url = new URL(testDatabaseUrl);
  const name = url.pathname.slice(1);
  const admin = new Client({ connectionString: Object.assign(new URL(url), { pathname: "/postgres" }).toString() });
  await admin.connect();
  const { rowCount } = await admin.query("select 1 from pg_database where datname = $1", [name]);
  if (!rowCount) await admin.query(`create database "${name.replace(/"/g, "")}"`);
  await admin.end();

  const pool = new Pool({ connectionString: testDatabaseUrl });
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });
  await pool.end();
}
