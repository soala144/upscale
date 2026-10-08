import "server-only";

import { getWatchupClient } from "./client";
import { getErrorName, logger } from "@/server/logging";

export type WatchupEventProperties = Record<
  string,
  string | number | boolean | null
>;

const sensitivePropertyName =
  /(authorization|token|secret|password|credential|conversation|message|content|email|phone)/i;
const safeTokenCountPropertyName = /^(input|output|total)_tokens$/;

export function trackEvent(
  name: string,
  properties: WatchupEventProperties = {},
): void {
  if (!/^[a-z][a-z0-9._-]{0,99}$/.test(name)) {
    logger.warn("watchup.event.rejected_invalid_name");
    return;
  }

  const unsafeProperty = Object.entries(properties).find(
    ([key, value]) =>
      sensitivePropertyName.test(key) &&
      !(
        safeTokenCountPropertyName.test(key) &&
        typeof value === "number" &&
        Number.isSafeInteger(value) &&
        value >= 0
      ),
  );

  if (unsafeProperty) {
    logger.warn("watchup.event.rejected_sensitive_property");
    return;
  }

  const watchup = getWatchupClient();
  if (!watchup) {
    return;
  }

  try {
    watchup.track(name, properties);
  } catch (error) {
    logger.error("watchup.event.failed", {
      eventName: name,
      errorName: getErrorName(error),
    });
  }
}
