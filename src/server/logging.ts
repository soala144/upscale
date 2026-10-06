type LogLevel = "info" | "warn" | "error";
type LogContext = Record<string, string | number | boolean | null>;

function writeLog(
  level: LogLevel,
  event: string,
  context: LogContext = {},
): void {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...context,
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.info(output);
  }
}

export const logger = {
  info: (event: string, context?: LogContext) =>
    writeLog("info", event, context),
  warn: (event: string, context?: LogContext) =>
    writeLog("warn", event, context),
  error: (event: string, context?: LogContext) =>
    writeLog("error", event, context),
};

export function getErrorName(error: unknown): string {
  if (error instanceof Error) {
    const safeNames = new Set([
      "AggregateError",
      "Error",
      "RangeError",
      "ReferenceError",
      "SyntaxError",
      "TypeError",
      "ZodError",
    ]);

    if (safeNames.has(error.name)) {
      return error.name;
    }

    return "ApplicationError";
  }

  return "UnknownError";
}
