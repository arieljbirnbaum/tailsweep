/**
 * SQLite (libsql) client scaffold. Local file by default.
 * Swap URL for Turso in production later — still no due math here.
 */

import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export function createDb(url = process.env.DATABASE_URL ?? "file:./tailsweep.db") {
  const client = createClient({ url });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
