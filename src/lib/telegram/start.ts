export type StartPayload =
  | { type: "lead"; leadId: string }
  | { type: "source"; tag: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parses Telegram deep-link starts: "/start f_<leadId>" (from the lead form)
 * and "/start s_<tag>" (campaign source). Returns null for other messages.
 * A bare "/start" yields { type: "source", tag: "" } handled as a greeting by callers.
 */
export function parseStartPayload(text: string | undefined | null): StartPayload | null | "bare" {
  const match = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/i.exec((text ?? "").trim());
  if (!match) return null;
  const payload = match[1];
  if (!payload) return "bare";
  if (payload.startsWith("f_") && uuid.test(payload.slice(2))) {
    return { type: "lead", leadId: payload.slice(2).toLowerCase() };
  }
  if (payload.startsWith("s_") && /^[a-z0-9-]{1,30}$/i.test(payload.slice(2))) {
    return { type: "source", tag: payload.slice(2).toLowerCase() };
  }
  return "bare";
}
