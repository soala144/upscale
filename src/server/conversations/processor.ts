import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { conversations } from "@/db/schema/conversations";
import { leads } from "@/db/schema/leads";
import { messages } from "@/db/schema/messages";
import { organizations } from "@/db/schema/organizations";
import { telegramUpdates } from "@/db/schema/telegram-updates";
import { scoreLead } from "@/lib/scoring/scoreLead";
import { generateQualificationReply } from "@/server/ai";
import { trackEvent } from "@/server/integrations/watchup";

export async function processConversationMessage(input: {
  organizationId: string;
  channel: "TELEGRAM";
  externalUserId: string;
  telegramConnectionId?: string;
  displayName?: string;
  content: string;
  updateReceiptId?: string;
}) {
  const db = getDatabase();
  const [receipt] = input.updateReceiptId
    ? await db
        .select({
          leadId: telegramUpdates.leadId,
          conversationId: telegramUpdates.conversationId,
          userMessageId: telegramUpdates.userMessageId,
        })
        .from(telegramUpdates)
        .where(eq(telegramUpdates.id, input.updateReceiptId))
        .limit(1)
    : [];

  const context = await db.transaction(async (tx) => {
    let lead;
    let conversation;
    let userMessageId = receipt?.userMessageId ?? null;
    let leadCreated = false;

    if (receipt?.leadId && receipt.conversationId && userMessageId) {
      [lead] = await tx
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.id, receipt.leadId),
            eq(leads.organizationId, input.organizationId),
          ),
        )
        .limit(1);
      [conversation] = await tx
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.id, receipt.conversationId),
            eq(conversations.organizationId, input.organizationId),
          ),
        )
        .limit(1);
    } else {
      [lead] = await tx
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.organizationId, input.organizationId),
            eq(leads.telegramUserId, input.externalUserId),
          ),
        )
        .limit(1);

      if (!lead) {
        const [insertedLead] = await tx
          .insert(leads)
          .values({
            id: randomUUID(),
            organizationId: input.organizationId,
            telegramConnectionId: input.telegramConnectionId ?? null,
            telegramUserId: input.externalUserId,
            source: input.channel,
            name: input.displayName ?? null,
            stage: "NEW",
          })
          .onConflictDoNothing()
          .returning();

        if (insertedLead) {
          lead = insertedLead;
          leadCreated = true;
        } else {
          [lead] = await tx
            .select()
            .from(leads)
            .where(
              and(
                eq(leads.organizationId, input.organizationId),
                eq(leads.telegramUserId, input.externalUserId),
              ),
            )
            .limit(1);
        }
      }

      if (!lead) {
        throw new Error("Unable to create or find the conversation lead");
      }

      [conversation] = await tx
        .select()
        .from(conversations)
        .where(
          and(
            eq(conversations.organizationId, input.organizationId),
            eq(conversations.leadId, lead.id),
            eq(conversations.channel, input.channel),
          ),
        )
        .limit(1);

      if (!conversation) {
        const [insertedConversation] = await tx
          .insert(conversations)
          .values({
            id: randomUUID(),
            organizationId: input.organizationId,
            leadId: lead.id,
            channel: input.channel,
            status: "ACTIVE",
            aiPaused: false,
          })
          .onConflictDoNothing()
          .returning();

        if (insertedConversation) {
          conversation = insertedConversation;
        } else {
          [conversation] = await tx
            .select()
            .from(conversations)
            .where(
              and(
                eq(conversations.organizationId, input.organizationId),
                eq(conversations.leadId, lead.id),
                eq(conversations.channel, input.channel),
              ),
            )
            .limit(1);
        }
      }

      if (!conversation) {
        throw new Error("Unable to create or find the conversation");
      }
    }

    if (!lead || !conversation) {
      throw new Error("Unable to resume the conversation update");
    }

    if (input.displayName && !lead.name) {
      const [updatedLead] = await tx
        .update(leads)
        .set({ name: input.displayName, updatedAt: new Date() })
        .where(eq(leads.id, lead.id))
        .returning();
      lead = updatedLead ?? lead;
    }

    if (!userMessageId) {
      userMessageId = randomUUID();
      await tx.insert(messages).values({
        id: userMessageId,
        organizationId: input.organizationId,
        conversationId: conversation.id,
        role: "USER",
        content: input.content,
        channel: input.channel,
      });

      if (input.updateReceiptId) {
        await tx
          .update(telegramUpdates)
          .set({
            leadId: lead.id,
            conversationId: conversation.id,
            userMessageId,
          })
          .where(eq(telegramUpdates.id, input.updateReceiptId));
      }
    }

    return { lead, conversation, userMessageId, leadCreated };
  });

  if (context.leadCreated) {
    trackEvent("lead.created", {
      organizationId: input.organizationId,
      leadId: context.lead.id,
    });
  }

  const [organization] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      industry: organizations.industry,
      description: organizations.description,
      agentName: organizations.agentName,
      agentPrompt: organizations.agentPrompt,
    })
    .from(organizations)
    .where(eq(organizations.id, input.organizationId))
    .limit(1);

  if (!organization) {
    throw new Error("Conversation organization not found");
  }

  const [currentLead] = await db
    .select()
    .from(leads)
    .where(
      and(
        eq(leads.id, context.lead.id),
        eq(leads.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!currentLead) {
    throw new Error("Conversation lead not found");
  }

  if (
    context.conversation.aiPaused ||
    context.conversation.status !== "ACTIVE" ||
    context.lead.handedOff
  ) {
    return {
      leadId: context.lead.id,
      conversationId: context.conversation.id,
      assistantMessageId: null,
      reply: null,
      paused: true,
    };
  }

  const history = await db
    .select({
      role: messages.role,
      content: messages.content,
    })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, context.conversation.id),
        eq(messages.organizationId, input.organizationId),
      ),
    )
    .orderBy(desc(messages.createdAt), desc(messages.id))
    .limit(20);

  const qualification = await generateQualificationReply({
    organization: {
      id: organization.id,
      name: organization.name,
      industry: organization.industry,
      description: organization.description,
      agentName: organization.agentName,
      agentPrompt: organization.agentPrompt,
    },
    lead: {
      need: currentLead.need,
      budget: currentLead.budget,
      location: currentLead.location,
      timeline: currentLead.timeline,
      decisionMaker: currentLead.decisionMaker,
    },
    history: history.reverse().flatMap((message) => {
      if (message.role === "SYSTEM") {
        return [];
      }
      return [{ role: message.role, content: message.content }];
    }),
  });

  const response = qualification.result;
  const assistantMessageId = randomUUID();
  const scoredLead = await db.transaction(async (tx) => {
    let scoreEvent: {
      score: number;
      stage: "HOT" | "WARM" | "COLD" | "PAYMENT_PENDING" | "CONVERTED";
      handoffRequested: boolean;
      leadId: string;
    } | null = null;

    if (!qualification.usedFallback) {
      const [lead] = await tx
        .select()
        .from(leads)
        .where(
          and(
            eq(leads.id, context.lead.id),
            eq(leads.organizationId, input.organizationId),
          ),
        )
        .limit(1);

      if (!lead) {
        throw new Error("Conversation lead not found");
      }

      const need = response.qualification.need ?? lead.need;
      const budget =
        response.qualification.budget === null
          ? lead.budget
          : String(response.qualification.budget);
      const timeline = response.qualification.timeline ?? lead.timeline;
      const decisionMaker =
        response.qualification.decision_maker ?? lead.decisionMaker;
      const score = scoreLead({
        need,
        budget,
        timeline,
        decisionMaker,
      });
      const handoffRequested =
        !lead.handedOff &&
        (response.human_requested || response.handoff_required);
      const stage =
        lead.stage === "PAYMENT_PENDING" || lead.stage === "CONVERTED"
          ? lead.stage
          : score.stage;

      await tx
        .update(leads)
        .set({
          need,
          budget,
          location: response.qualification.location ?? lead.location,
          timeline,
          decisionMaker,
          summary: response.summary || lead.summary,
          urgent:
            lead.urgent ||
            response.human_requested ||
            response.handoff_required,
          handedOff: lead.handedOff || handoffRequested,
          score: score.score,
          stage,
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));
      scoreEvent = {
        score: score.score,
        stage,
        handoffRequested,
        leadId: lead.id,
      };
    }

    await tx.insert(messages).values({
      id: assistantMessageId,
      organizationId: input.organizationId,
      conversationId: context.conversation.id,
      role: "ASSISTANT",
      content: response.reply,
      channel: input.channel,
    });
    await tx
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, context.conversation.id));
    if (input.updateReceiptId) {
      await tx
        .update(telegramUpdates)
        .set({
          assistantMessageId,
          status: "REPLY_PENDING",
        })
        .where(eq(telegramUpdates.id, input.updateReceiptId));
    }
    return scoreEvent;
  });

  if (scoredLead) {
    trackEvent("lead.scored", {
      organizationId: input.organizationId,
      leadId: scoredLead.leadId,
      score: scoredLead.score,
      stage: scoredLead.stage,
    });
    if (scoredLead.handoffRequested) {
      trackEvent("lead.handoff_requested", {
        organizationId: input.organizationId,
        leadId: scoredLead.leadId,
      });
    }
  }

  return {
    leadId: context.lead.id,
    conversationId: context.conversation.id,
    assistantMessageId,
    reply: response.reply,
    paused: false,
  };
}
