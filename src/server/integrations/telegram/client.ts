import "server-only";

import { z } from "zod";

export class TelegramApiError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 502,
  ) {
    super(message);
    this.name = "TelegramApiError";
  }
}

const getMeResultSchema = z.object({
  id: z.number().int().positive(),
  is_bot: z.literal(true),
  first_name: z.string().min(1),
  username: z.string().min(1),
});

async function callTelegram<T>(
  token: string,
  method: string,
  body: Record<string, unknown>,
  parseResult: (value: unknown) => T,
  invalidTokenIsClientError = false,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(
      `https://api.telegram.org/bot${token}/${method}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch {
    throw new TelegramApiError("Telegram API request failed", 502);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new TelegramApiError("Telegram returned an invalid response", 502);
  }

  const envelope = z
    .object({
      ok: z.boolean(),
      result: z.unknown().optional(),
      error_code: z.number().int().optional(),
    })
    .safeParse(payload);
  if (!response.ok || !envelope.success) {
    throw new TelegramApiError("Telegram API request failed", 502);
  }
  if (!envelope.data.ok) {
    const invalidToken =
      invalidTokenIsClientError && envelope.data.error_code === 401;
    throw new TelegramApiError(
      invalidToken ? "Telegram bot token is invalid" : "Telegram API request failed",
      invalidToken ? 400 : 502,
    );
  }

  try {
    return parseResult(envelope.data.result);
  } catch {
    throw new TelegramApiError("Telegram returned an invalid response", 502);
  }
}

export async function getTelegramBot(token: string) {
  return callTelegram(
    token,
    "getMe",
    {},
    (value) => getMeResultSchema.parse(value),
    true,
  );
}

export async function registerTelegramWebhook(
  token: string,
  webhookUrl: string,
  secret: string,
) {
  return callTelegram(
    token,
    "setWebhook",
    {
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message"],
    },
    (value) => z.literal(true).parse(value),
  );
}

export async function deleteTelegramWebhook(token: string) {
  return callTelegram(
    token,
    "deleteWebhook",
    {},
    (value) => z.literal(true).parse(value),
  );
}

export async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
) {
  return callTelegram(
    token,
    "sendMessage",
    { chat_id: chatId, text },
    (value) =>
      z
        .object({
          message_id: z.number().int().positive(),
        })
        .passthrough()
        .parse(value),
  );
}

export type TelegramSendResult =
  | { ok: true; messageId: number }
  | {
      ok: false;
      /** BLOCKED: user blocked/deactivated; INVALID: bad chat or content;
       * RATE_LIMITED/TRANSIENT: safe to retry; UNKNOWN_OUTCOME: request may
       * have reached Telegram, so retrying could duplicate the message. */
      kind: "BLOCKED" | "INVALID" | "RATE_LIMITED" | "TRANSIENT" | "UNAUTHORIZED" | "UNKNOWN_OUTCOME";
      retryAfterSeconds?: number;
    };

/**
 * sendMessage with the outcome classified for campaign delivery. Never throws
 * and never includes the token, chat id or message text in its result.
 */
export async function sendTelegramMessageDetailed(
  token: string,
  chatId: number,
  text: string,
): Promise<TelegramSendResult> {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { ok: false, kind: "UNKNOWN_OUTCOME" };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return response.status >= 500
      ? { ok: false, kind: "TRANSIENT" }
      : { ok: false, kind: "UNKNOWN_OUTCOME" };
  }

  const parsed = z
    .object({
      ok: z.boolean(),
      result: z.object({ message_id: z.number().int().positive() }).passthrough().optional(),
      error_code: z.number().int().optional(),
      description: z.string().optional(),
      parameters: z.object({ retry_after: z.number().optional() }).optional(),
    })
    .safeParse(payload);
  if (!parsed.success) return { ok: false, kind: "UNKNOWN_OUTCOME" };

  const body = parsed.data;
  if (body.ok && body.result) return { ok: true, messageId: body.result.message_id };

  const code = body.error_code ?? response.status;
  if (code === 429) {
    return { ok: false, kind: "RATE_LIMITED", retryAfterSeconds: body.parameters?.retry_after ?? 5 };
  }
  if (code === 401) return { ok: false, kind: "UNAUTHORIZED" };
  if (code === 403) return { ok: false, kind: "BLOCKED" };
  if (code === 400) return { ok: false, kind: "INVALID" };
  if (code >= 500) return { ok: false, kind: "TRANSIENT" };
  return { ok: false, kind: "INVALID" };
}
