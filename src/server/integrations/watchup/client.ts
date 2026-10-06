import "server-only";

import { initWatchup } from "@watchupltd/nextjs/server";

import { getErrorName, logger } from "@/server/logging";

type WatchupClient = ReturnType<typeof initWatchup>;
type EndTrace = ReturnType<WatchupClient["startTrace"]>;
type RequestHandler<Arguments extends unknown[]> = (
  request: Request,
  ...args: Arguments
) => Response | Promise<Response>;

let client: WatchupClient | undefined;
let missingKeyWarningLogged = false;

export function initializeWatchup(apiKey?: string): WatchupClient | undefined {
  if (client) {
    return client;
  }

  const configuredApiKey = apiKey?.trim();
  if (!configuredApiKey) {
    if (!missingKeyWarningLogged) {
      logger.warn("watchup.disabled", {
        reason: "WATCHUP_API_KEY is not configured",
      });
      missingKeyWarningLogged = true;
    }
    return undefined;
  }

  client = initWatchup({
    apiKey: configuredApiKey,
    environment: process.env.NODE_ENV ?? "development",
  });

  return client;
}

export function getWatchupClient(): WatchupClient | undefined {
  if (client) {
    return client;
  }

  const apiKey = process.env.WATCHUP_API_KEY?.trim();
  return initializeWatchup(apiKey);
}

export function trackRequest<Arguments extends unknown[]>(
  route: string,
  handler: RequestHandler<Arguments>,
): RequestHandler<Arguments> {
  return async (request, ...args) => {
    const watchup = getWatchupClient();
    const endTrace = watchup
      ? startTrace(watchup, route)
      : undefined;

    try {
      const response = await handler(request, ...args);
      finishTrace(endTrace, response.status >= 500 ? "err" : "ok", route, {
        statusCode: response.status,
      });
      return response;
    } catch (error) {
      finishTrace(endTrace, "err", route);
      captureRequestError(error, route);
      throw error;
    }
  };
}

function startTrace(
  watchup: WatchupClient,
  route: string,
): EndTrace | undefined {
  try {
    return watchup.startTrace(route);
  } catch (error) {
    logger.warn("watchup.trace.start.failed", {
      area: route,
      errorName: getErrorName(error),
    });
    return undefined;
  }
}

function finishTrace(
  endTrace: EndTrace | undefined,
  status: "ok" | "err",
  route: string,
  meta?: Record<string, unknown>,
): void {
  if (!endTrace) {
    return;
  }

  try {
    endTrace({ status, meta });
  } catch (error) {
    logger.warn("watchup.trace.finish.failed", {
      area: route,
      errorName: getErrorName(error),
    });
  }
}

function captureRequestError(error: unknown, route: string): void {
  const watchup = getWatchupClient();
  if (!watchup) {
    return;
  }

  const sanitizedError = new Error("An application request failed");
  sanitizedError.name = getErrorName(error);

  try {
    watchup.captureError(sanitizedError, { route });
  } catch (captureFailure) {
    logger.error("watchup.request_error_capture.failed", {
      area: route,
      errorName: getErrorName(captureFailure),
    });
  }
}
