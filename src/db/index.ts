import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { getServerEnv } from "@/lib/env/server";
import { captureError } from "@/server/integrations/watchup";
import { getErrorName, logger } from "@/server/logging";

import * as schema from "./schema";

const globalForDatabase = globalThis as typeof globalThis & {
  upscalePool?: Pool;
  upscaleDb?: ReturnType<typeof drizzle>;
};

export function getDatabase() {
  if (globalForDatabase.upscaleDb) {
    return globalForDatabase.upscaleDb;
  }

  const pool =
    globalForDatabase.upscalePool ??
    new Pool({
      connectionString: getServerEnv().DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5_000,
    });

  if (!globalForDatabase.upscalePool) {
    globalForDatabase.upscalePool = pool;
    pool.on("error", (error: Error & { code?: string }) => {
      logger.error("database.pool.error", {
        errorName: getErrorName(error),
        errorCode: error.code ?? null,
      });
      captureError(error, "database.pool");
    });
  }

  globalForDatabase.upscaleDb = drizzle(pool, { schema });
  return globalForDatabase.upscaleDb;
}
