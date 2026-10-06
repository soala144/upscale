import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { conversations } from "@/db/schema/conversations";
import { leads } from "@/db/schema/leads";
import { messages } from "@/db/schema/messages";

export async function listOrganizationLeads(organizationId: string) {
  return getDatabase()
    .select()
    .from(leads)
    .where(eq(leads.organizationId, organizationId))
    .orderBy(desc(leads.updatedAt), desc(leads.createdAt))
    .limit(200);
}

export async function getOrganizationLead(
  organizationId: string,
  leadId: string,
) {
  const [lead] = await getDatabase()
    .select()
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), eq(leads.id, leadId)))
    .limit(1);

  return lead ?? null;
}

export async function getLeadConversation(
  organizationId: string,
  leadId: string,
) {
  const [conversation] = await getDatabase()
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.organizationId, organizationId),
        eq(conversations.leadId, leadId),
      ),
    )
    .orderBy(desc(conversations.updatedAt))
    .limit(1);

  if (!conversation) {
    return null;
  }

  const history = await getDatabase()
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      channel: messages.channel,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(
      and(
        eq(messages.organizationId, organizationId),
        eq(messages.conversationId, conversation.id),
      ),
    )
    .orderBy(messages.createdAt, messages.id)
    .limit(500);

  return { ...conversation, messages: history };
}
