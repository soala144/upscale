import "server-only";

import { randomUUID } from "node:crypto";
import { and, asc, count, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { knowledgeItems } from "@/db/schema/knowledge";
import type { KnowledgeEntry } from "@/lib/knowledge/select";
import type { KnowledgeItemInput } from "@/lib/validation/knowledge";
import { trackEvent } from "@/server/integrations/watchup";

export class KnowledgeError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 409,
  ) {
    super(message);
    this.name = "KnowledgeError";
  }
}

/** Per-organization cap keeps prompts, queries and imports bounded. */
export const MAX_KNOWLEDGE_ITEMS = 500;

const columns = {
  id: knowledgeItems.id,
  kind: knowledgeItems.kind,
  title: knowledgeItems.title,
  content: knowledgeItems.content,
  price: knowledgeItems.price,
  currency: knowledgeItems.currency,
  available: knowledgeItems.available,
  updatedAt: knowledgeItems.updatedAt,
};

export async function listKnowledge(organizationId: string) {
  return getDatabase()
    .select(columns)
    .from(knowledgeItems)
    .where(eq(knowledgeItems.organizationId, organizationId))
    .orderBy(asc(knowledgeItems.kind), asc(knowledgeItems.title))
    .limit(MAX_KNOWLEDGE_ITEMS);
}

/** Entries the bot may use: only this organization's, and only available products and FAQs. */
export async function getKnowledgeForPrompt(
  organizationId: string,
): Promise<KnowledgeEntry[]> {
  const rows = await getDatabase()
    .select(columns)
    .from(knowledgeItems)
    .where(eq(knowledgeItems.organizationId, organizationId))
    .orderBy(asc(knowledgeItems.kind), asc(knowledgeItems.title))
    .limit(MAX_KNOWLEDGE_ITEMS);
  return rows.map((row) => ({
    kind: row.kind,
    title: row.title,
    content: row.content,
    price: row.price,
    currency: row.currency,
    available: row.available,
  }));
}

async function assertCapacity(organizationId: string, adding: number) {
  const [{ total }] = await getDatabase()
    .select({ total: count() })
    .from(knowledgeItems)
    .where(eq(knowledgeItems.organizationId, organizationId));
  if (total + adding > MAX_KNOWLEDGE_ITEMS) {
    throw new KnowledgeError(
      `A workspace can hold up to ${MAX_KNOWLEDGE_ITEMS} entries.`,
      409,
    );
  }
}

function toRow(organizationId: string, input: KnowledgeItemInput) {
  return {
    organizationId,
    kind: input.kind,
    title: input.title,
    content: input.content,
    price:
      input.kind === "PRODUCT" && input.price != null
        ? input.price.toFixed(2)
        : null,
    available: input.available,
  };
}

export async function createKnowledgeItems(
  organizationId: string,
  inputs: KnowledgeItemInput[],
) {
  await assertCapacity(organizationId, inputs.length);
  await getDatabase()
    .insert(knowledgeItems)
    .values(inputs.map((input) => ({ id: randomUUID(), ...toRow(organizationId, input) })));
  trackEvent("knowledge.items.created", { organizationId, count: inputs.length });
  return { created: inputs.length };
}

export async function updateKnowledgeItem(
  organizationId: string,
  itemId: string,
  input: KnowledgeItemInput,
) {
  const [updated] = await getDatabase()
    .update(knowledgeItems)
    .set({ ...toRow(organizationId, input), updatedAt: new Date() })
    .where(
      and(
        eq(knowledgeItems.id, itemId),
        eq(knowledgeItems.organizationId, organizationId),
      ),
    )
    .returning({ id: knowledgeItems.id });
  if (!updated) throw new KnowledgeError("Entry not found", 404);
}

export async function deleteKnowledgeItem(organizationId: string, itemId: string) {
  const [deleted] = await getDatabase()
    .delete(knowledgeItems)
    .where(
      and(
        eq(knowledgeItems.id, itemId),
        eq(knowledgeItems.organizationId, organizationId),
      ),
    )
    .returning({ id: knowledgeItems.id });
  if (!deleted) throw new KnowledgeError("Entry not found", 404);
}
