/**
 * App-edge SQLite singleton.
 *
 * First use opens the DB (`DATABASE_URL` or `file:./duekeep.db`) and runs
 * existing `applyMigrations`, so `pnpm dev` does not need a manual migrate.
 * Tests keep using `createDb` on temp files — they do not go through this.
 */

import { applyMigrations, createDb, type Db } from "@/db";

let opening: Promise<Db> | undefined;

/** Open (once) and migrate. A failed migrate clears the slot so a later call can retry. */
export function getAppDb(): Promise<Db> {
  if (opening === undefined) {
    const db = createDb();
    opening = applyMigrations(db).then(
      () => db,
      (err: unknown) => {
        opening = undefined;
        throw err;
      },
    );
  }
  return opening;
}
