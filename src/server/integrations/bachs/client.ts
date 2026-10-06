import "server-only";

import { getServerEnv } from "@/lib/env/server";

export class BachsApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "BachsApiError";
  }
}

export function requireBachsApiKey() {
  const env = getServerEnv();
  const apiKey = env.BACHS_API_KEY;
  if (!apiKey) {
    throw new BachsApiError("Bachs is not configured", 503);
  }
  const expectedPrefix =
    env.BACHS_ENV === "production" ? "sk_live_" : "sk_sandbox_";
  if (!apiKey.startsWith(expectedPrefix)) {
    throw new BachsApiError(
      "Bachs key does not match the selected environment",
      503,
    );
  }
  return apiKey;
}

export function bachsApiUrl(path: string) {
  const baseUrl =
    getServerEnv().BACHS_ENV === "production"
      ? "https://api.bachs.io"
      : "https://sandbox-api.bachs.io";

  return new URL(path, baseUrl);
}

export async function bachsRequest<T>(
  path: string,
  idempotencyKey: string,
  body: unknown,
  parse: (value: unknown) => T,
  options: { accountId?: string } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(bachsApiUrl(path), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requireBachsApiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
        ...(options.accountId ? { "X-Account-Id": options.accountId } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof BachsApiError) {
      throw error;
    }
    throw new BachsApiError("Bachs checkout request failed", 502);
  }

  if (!response.ok) {
    throw new BachsApiError("Bachs checkout request failed", response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new BachsApiError("Bachs returned an invalid response", response.status);
  }

  try {
    return parse(payload);
  } catch {
    throw new BachsApiError("Bachs returned an invalid response", 502);
  }
}

export async function bachsGet<T>(
  path: string,
  parse: (value: unknown) => T,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(bachsApiUrl(path), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${requireBachsApiKey()}`,
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (error) {
    if (error instanceof BachsApiError) {
      throw error;
    }
    throw new BachsApiError("Bachs API request failed", 502);
  }

  if (!response.ok) {
    throw new BachsApiError("Bachs API request failed", response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new BachsApiError("Bachs returned an invalid response", 502);
  }

  try {
    return parse(payload);
  } catch {
    throw new BachsApiError("Bachs returned an invalid response", 502);
  }
}
