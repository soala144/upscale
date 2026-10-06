import "server-only";

import { getWatchupClient } from "./client";
import { getErrorName, logger } from "@/server/logging";

export function captureError(error: unknown, area: string): void {
  const watchup = getWatchupClient();
  if (!watchup) {
    return;
  }

  const sanitizedError = new Error("An application operation failed");
  sanitizedError.name = getErrorName(error);

  try {
    watchup.captureError(sanitizedError, { area });
  } catch (captureFailure) {
    logger.error("watchup.error_capture.failed", {
      area,
      errorName: getErrorName(captureFailure),
    });
  }
}
