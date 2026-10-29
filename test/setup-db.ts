import { beforeAll } from "vitest";

import { migrateDatabase } from "@/lib/db";

// Each test file gets its own in-memory PGlite database.
beforeAll(() => migrateDatabase());
