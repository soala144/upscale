import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import { getServerEnv } from "@/lib/env/server";
import { captureError, trackEvent } from "@/server/integrations/watchup";
import { getErrorName, logger } from "@/server/logging";

import { buildQualificationPrompt } from "./prompts";
import {
  claudeQualificationResponseSchema,
  type ClaudeLeadContext,
  type ClaudeOrganizationContext,
  type ClaudeQualificationResponse,
  type ConversationHistoryItem,
} from "./types";

const CLAUDE_MODEL = "claude-sonnet-5-5";
const FALLBACK_REPLY =
  "Thanks for reaching out. I am having trouble responding right now. Please try again shortly.";

export type QualificationResult = {
  result: ClaudeQualificationResponse;
  usedFallback: boolean;
};

function fallbackResult(): QualificationResult {
  return {
    result: {
      reply: FALLBACK_REPLY,
      qualification: {
        need: null,
        budget: null,
        location: null,
        timeline: null,
        decision_maker: null,
      },
      summary: "",
      human_requested: false,
      handoff_required: false,
    },
    usedFallback: true,
  };
}

export async function generateQualificationReply(input: {
  organization: ClaudeOrganizationContext;
  lead: ClaudeLeadContext;
  history: ConversationHistoryItem[];
}): Promise<QualificationResult> {
  trackEvent("ai.request.started", { organizationId: input.organization.id });
  const apiKey = getServerEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.warn("ai.request.failed", {
      organizationId: input.organization.id,
      errorName: "AnthropicNotConfigured",
    });
    trackEvent("ai.request.failed", {
      organizationId: input.organization.id,
      errorName: "AnthropicNotConfigured",
    });
    captureError(new Error("Anthropic integration is not configured"), "ai.claude");
    return fallbackResult();
  }

  try {
    const response = await new Anthropic({
      apiKey,
      timeout: 30_000,
      maxRetries: 1,
    }).messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 900,
      system: buildQualificationPrompt(input.organization, input.lead),
      messages: input.history.map((message) => ({
        role: message.role === "USER" ? "user" : "assistant",
        content: message.content,
      })),
    });

    const responseText = response.content.find(
      (block) => block.type === "text",
    )?.text;
    if (!responseText) {
      throw new Error("Claude response contained no text");
    }

    const result = claudeQualificationResponseSchema.parse(
      JSON.parse(responseText),
    );
    trackEvent("ai.request.completed", {
      organizationId: input.organization.id,
    });
    return { result, usedFallback: false };
  } catch (error) {
    const errorName = getErrorName(error);
    logger.error("ai.request.failed", {
      organizationId: input.organization.id,
      errorName,
    });
    trackEvent("ai.request.failed", {
      organizationId: input.organization.id,
      errorName,
    });
    captureError(
      new Error(`Claude request failed (${errorName})`),
      "ai.claude",
    );
    return fallbackResult();
  }
}
