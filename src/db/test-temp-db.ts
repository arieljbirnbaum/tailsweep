/**
 * Shared temp-SQLite cleanup for migrate / adapter integration tests.
 *
 * Close libsql clients before rm so Windows can delete locked DB files.
 * Retry EPERM/EBUSY with backoff; warn (don’t fail) if the dir still lingers.
 */

import { readdirSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";

import type { Db } from "./client";

const RM_MAX_ATTEMPTS = 8;
const RM_BASE_DELAY_MS = 50;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errCode(err: unknown): string {
  // `in` narrowing exposes .code — no type assertion.
  return err && typeof err === "object" && "code" in err
    ? String(err.code)
    : "";
}

/**
 * Close libsql clients first so Windows can delete the locked DB files.
 * @libsql/client@0.18 Client.close() is sync (`void`); still await if a
 * Promise is returned so future/async close implementations stay correct.
 */
export async function closeClients(clients: Db[]): Promise<void> {
  for (const db of clients.splice(0)) {
    try {
      await Promise.resolve(db.$client.close());
    } catch {
      // already closed / disposed
    }
  }
}

/** Best-effort: drop SQLite main + WAL/SHM files before rmdir (Windows). */
function tryUnlinkSqliteFiles(dir: string): void {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (
      name.endsWith(".db") ||
      name.endsWith(".db-wal") ||
      name.endsWith(".db-shm") ||
      name.endsWith("-wal") ||
      name.endsWith("-shm")
    ) {
      try {
        unlinkSync(path.join(dir, name));
      } catch {
        // recursive rm will retry; ignore here
      }
    }
  }
}

/**
 * Remove temp dirs after closing clients. Retries EPERM/EBUSY (Windows file-lock linger).
 * Leftover dirs are warned, not thrown — assertions under test already passed.
 *
 * @param label — prefix for the leftover-dir warn message (e.g. `migrate.test`)
 */
export async function removeTempDirs(
  dirs: string[],
  label: string = "test-temp-db",
): Promise<void> {
  for (const dir of dirs.splice(0)) {
    tryUnlinkSqliteFiles(dir);

    let lastErr: unknown;
    for (let attempt = 1; attempt <= RM_MAX_ATTEMPTS; attempt++) {
      try {
        rmSync(dir, { recursive: true, force: true });
        lastErr = undefined;
        break;
      } catch (err) {
        lastErr = err;
        const code = errCode(err);
        if (code !== "EPERM" && code !== "EBUSY") {
          throw err;
        }
        if (attempt < RM_MAX_ATTEMPTS) {
          // Backoff ~50–100ms+ between retries (Windows file-lock linger).
          const delay = RM_BASE_DELAY_MS + Math.min(attempt - 1, 5) * 10;
          await sleepMs(delay);
          tryUnlinkSqliteFiles(dir);
        }
      }
    }

    if (lastErr) {
      console.warn(
        `[${label}] left temp dir after close+retries (${errCode(lastErr)}): ${dir}`,
      );
    }
  }
}
