export type ApiErrorCode =
  | "AUTHENTICATION_REQUIRED"
  | "PERMISSION_DENIED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "UNEXPECTED";

const messages: Record<ApiErrorCode, string> = {
  AUTHENTICATION_REQUIRED: "Your session has expired. Please sign in again.",
  PERMISSION_DENIED: "You don't have permission to perform this action.",
  VALIDATION_ERROR: "Please check the highlighted fields.",
  NOT_FOUND: "We couldn't find what you requested.",
  CONFLICT: "This resource already exists or conflicts with its current state.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
  SERVICE_UNAVAILABLE: "This service is temporarily unavailable.",
  UNEXPECTED: "Something went wrong on our side. Please try again.",
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: ApiErrorCode,
    /** Message supplied by the server for 4xx errors; safe to show to users. */
    public readonly serverMessage?: string,
    public readonly body?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function errorCode(status: number): ApiErrorCode {
  if (status === 401) return "AUTHENTICATION_REQUIRED";
  if (status === 403) return "PERMISSION_DENIED";
  if (status === 400 || status === 422) return "VALIDATION_ERROR";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  if (status === 502 || status === 503) return "SERVICE_UNAVAILABLE";
  return "UNEXPECTED";
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      cache: "no-store",
      credentials: "same-origin",
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ApiError(messages.UNEXPECTED, 0, "UNEXPECTED");
  }

  if (!response.ok) {
    const code = errorCode(response.status);
    let body: Record<string, unknown> | undefined;
    try {
      body = (await response.json()) as Record<string, unknown>;
    } catch {
      body = undefined;
    }
    const serverMessage =
      response.status >= 400 &&
      response.status < 500 &&
      response.status !== 401 &&
      typeof body?.error === "string"
        ? body.error
        : undefined;
    throw new ApiError(
      messages[code],
      response.status,
      code,
      serverMessage,
      body,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}
