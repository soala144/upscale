import { z } from "zod";

export const MAX_CAMPAIGN_RECIPIENTS = 2000;

export const leadStageValues = [
  "NEW",
  "QUALIFYING",
  "HOT",
  "WARM",
  "COLD",
  "PAYMENT_PENDING",
  "CONVERTED",
] as const;

const isoDate = z.string().datetime({ offset: true });

/**
 * Audience definition. When `leadIds` is non-empty the audience is exactly
 * those leads (still subject to eligibility); otherwise the filters apply
 * together (AND).
 */
export const audienceFiltersSchema = z
  .object({
    stages: z.array(z.enum(leadStageValues)).max(7).optional(),
    scoreMin: z.number().int().min(0).max(100).optional(),
    scoreMax: z.number().int().min(0).max(100).optional(),
    createdFrom: isoDate.optional(),
    createdTo: isoDate.optional(),
    /** Only leads we have not messaged (AI, human or broadcast) since this instant. */
    notContactedSince: isoDate.optional(),
    leadIds: z.array(z.string().min(1).max(100)).max(MAX_CAMPAIGN_RECIPIENTS).optional(),
  })
  .refine(
    (value) =>
      value.scoreMin === undefined ||
      value.scoreMax === undefined ||
      value.scoreMin <= value.scoreMax,
    { message: "Minimum score cannot exceed maximum score", path: ["scoreMin"] },
  )
  .refine(
    (value) =>
      !value.createdFrom ||
      !value.createdTo ||
      new Date(value.createdFrom) <= new Date(value.createdTo),
    { message: "Created-from must be before created-to", path: ["createdFrom"] },
  );

export type AudienceFilters = z.infer<typeof audienceFiltersSchema>;

export type IneligibleReason = "OPTED_OUT" | "NO_DESTINATION" | "NOT_CONNECTED";

export const ineligibleReasonLabels: Record<IneligibleReason, string> = {
  OPTED_OUT: "Opted out of broadcasts",
  NO_DESTINATION: "No valid Telegram chat",
  NOT_CONNECTED: "Lead is not linked to the connected bot",
};

/** Telegram private-chat ids are positive integers; groups/channels are negative. */
export function isValidTelegramChatId(value: string | null | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[1-9]\d{0,14}$/.test(value) &&
    Number.isSafeInteger(Number(value))
  );
}

export function evaluateEligibility(
  lead: {
    telegramUserId: string | null;
    telegramConnectionId: string | null;
    broadcastOptedOutAt: Date | string | null;
  },
  activeConnectionId: string | null,
): IneligibleReason | null {
  if (lead.broadcastOptedOutAt) return "OPTED_OUT";
  if (!isValidTelegramChatId(lead.telegramUserId)) return "NO_DESTINATION";
  if (!activeConnectionId || lead.telegramConnectionId !== activeConnectionId) {
    return "NOT_CONNECTED";
  }
  return null;
}
