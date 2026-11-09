// Applies database migrations to DATABASE_URL. Vercel runs it before
// `next build` (see "vercel-build" in package.json), so serverless cold starts
// never race to migrate. Without DATABASE_URL it does nothing: locally the app
// migrates its PGlite database on start.
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) {
  if (process.env.VERCEL) {
    console.error("DATABASE_URL is not set. Add a Postgres database (for example Neon from the Vercel Marketplace) and redeploy.");
    process.exit(1);
  }
  console.info("DATABASE_URL is not set. Skipping migrations.");
  process.exit(0);
}

const pool = new pg.Pool({ connectionString, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: "drizzle" });
  console.info("Database migrations applied.");
} finally {
  await pool.end();
}
