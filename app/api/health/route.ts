import { sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { captureError, trackRequest } from "@/server/integrations/watchup";
import { getErrorName, logger } from "@/server/logging";

export const GET = trackRequest("api.health", async () => {
  const timestamp = new Date().toISOString();

  try {
    await getDatabase().execute(sql`select 1`);

    return Response.json({
      status: "ok",
      service: "upscale",
      database: "ok",
      timestamp,
    });
  } catch (error) {
    logger.error("health.database_check.failed", {
      errorName: getErrorName(error),
    });
    captureError(error, "health.database_check");

    return Response.json(
      {
        status: "error",
        service: "upscale",
        database: "unavailable",
        timestamp,
      },
      { status: 503 },
    );
  }
});
