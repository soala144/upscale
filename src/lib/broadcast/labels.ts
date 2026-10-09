/** User-facing wording for recipient outcomes recorded by the sender. */
export const recipientReasonLabels: Record<string, string> = {
  OPTED_OUT: "Opted out of broadcasts",
  NO_DESTINATION: "No valid Telegram chat",
  NOT_CONNECTED: "Not linked to the connected bot",
  LEAD_DELETED: "Lead was deleted",
  CAMPAIGN_CANCELLED: "Campaign cancelled before sending",
  INVALID_DESTINATION: "Invalid Telegram chat",
  INVALID_CONTENT: "Message was empty or too long after personalization",
  RECIPIENT_BLOCKED: "Contact blocked the bot (now opted out)",
  REJECTED_BY_PROVIDER: "Telegram rejected the message",
  PROVIDER_ERROR: "Telegram was unavailable after retries",
  RATE_LIMITED: "Telegram rate limit persisted after retries",
  CHANNEL_DISCONNECTED: "Telegram was disconnected",
  CHANNEL_UNAUTHORIZED: "Telegram bot token was rejected",
  UNKNOWN_OUTCOME: "Outcome unknown; not retried to avoid a duplicate",
  INTERNAL_ERROR: "Internal error while sending",
};

export function describeRecipientOutcome(
  skipReason: string | null,
  errorCode: string | null,
) {
  const code = errorCode ?? skipReason;
  if (!code) return null;
  return recipientReasonLabels[code] ?? code;
}
