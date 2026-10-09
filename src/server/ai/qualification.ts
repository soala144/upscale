import "server-only";

import { APIError } from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import type { KnowledgeEntry } from "@/lib/knowledge/select";
import { getServerEnv } from "@/lib/env/server";
import { captureError, trackEvent } from "@/server/integrations/watchup";
import { getErrorName, logger } from "@/server/logging";

import { getOpenAIClient, OpenAIConfigurationError } from "./openai";
import { buildQualificationInstructions } from "./prompts";
import {
  qualificationResponseSchema,
  type LeadContext,
  type OrganizationContext,
  type QualificationResponse,
  type ConversationHistoryItem,
} from "./types";

const FALLBACK_REPLY =
  "Thanks for reaching out. I am having trouble responding right now. Please try again shortly.";

export type QualificationResult = {
  result: QualificationResponse;
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
  organization: OrganizationContext;
  lead: LeadContext;
  history: ConversationHistoryItem[];
  knowledge?: KnowledgeEntry[];
}): Promise<QualificationResult> {
  const startedAt = Date.now();
  const model = getServerEnv().OPENAI_MODEL;
  const eventContext = {
    organizationId: input.organization.id,
    provider: "openai",
    model,
  };
  trackEvent("ai.request.started", eventContext);

  try {
    const response = await getOpenAIClient().responses.parse({
      model,
      instructions: buildQualificationInstructions(
        input.organization,
        input.lead,
        input.knowledge ?? [],
      ),
      input: input.history.map((message) => ({
        role: message.role === "USER" ? "user" : "assistant",
        content: message.content,
      })),
      text: {
        format: zodTextFormat(
          qualificationResponseSchema,
          "lead_qualification",
        ),
      },
      max_output_tokens: 900,
      store: false,
    });

    if (!response.output_parsed) {
      throw new Error("OpenAI returned no structured qualification");
    }
    const result = qualificationResponseSchema.parse(response.output_parsed);
    const durationMs = Date.now() - startedAt;

    trackEvent("ai.request.completed", {
      ...eventContext,
      duration_ms: durationMs,
      input_tokens: response.usage?.input_tokens ?? 0,
      output_tokens: response.usage?.output_tokens ?? 0,
      total_tokens: response.usage?.total_tokens ?? 0,
    });
    return { result, usedFallback: false };
  } catch (error) {
    const errorName =
      error instanceof OpenAIConfigurationError
        ? "OpenAIConfigurationError"
        : getErrorName(error);
    const durationMs = Date.now() - startedAt;
    logger.error("ai.request.failed", {
      organizationId: input.organization.id,
      provider: "openai",
      model,
      durationMs,
      errorName,
      // Provider status and code (e.g. 429 insufficient_quota) contain no secrets.
      providerStatus: error instanceof APIError ? (error.status ?? null) : null,
      providerCode: error instanceof APIError ? (error.code ?? null) : null,
    });
    trackEvent("ai.request.failed", {
      ...eventContext,
      duration_ms: durationMs,
      errorName,
    });
    captureError(new Error(`OpenAI qualification request failed (${errorName})`), "ai.openai");
    return fallbackResult();
  }
}
