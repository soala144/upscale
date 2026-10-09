import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq, or, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import { leads } from "@/db/schema/leads";
import { normalizePhone, type LeadInput } from "@/lib/leads/input";
import { scoreLead } from "@/lib/scoring/scoreLead";
import { trackEvent } from "@/server/integrations/watchup";

export class LeadInputError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
    public readonly existingLeadId?: string,
  ) {
    super(message);
    this.name = "LeadInputError";
  }
}

async function findDuplicate(
  organizationId: string,
  phone: string | null,
  email: string | null,
) {
  const matches = [
    phone ? eq(leads.phone, phone) : undefined,
    email ? sql`lower(${leads.email}) = ${email}` : undefined,
  ].filter((match) => match !== undefined);
  if (!matches.length) return null;
  const [existing] = await getDatabase()
    .select({ id: leads.id })
    .from(leads)
    .where(and(eq(leads.organizationId, organizationId), or(...matches)))
    .limit(1);
  return existing ?? null;
}

/**
 * Qualification signals the owner already knows give an initial score. The
 * stage only leaves NEW when at least two of the four signals are present, so
 * a lead with just a name and need is not mislabelled as COLD.
 */
export function initialScoring(input: LeadInput) {
  const score = scoreLead({
    need: input.need ?? null,
    budget: input.budget ?? null,
    timeline: input.timeline ?? null,
    decisionMaker: input.decisionMaker ?? null,
  });
  const signals = Object.values(score.breakdown).filter((value) => value > 0).length;
  return { score: score.score, stage: signals >= 2 ? score.stage : ("NEW" as const) };
}

export async function createLead(
  organizationId: string,
  input: LeadInput,
  source: string,
): Promise<{ id: string; created: boolean }> {
  const phone = normalizePhone(input.phone);
  const duplicate = await findDuplicate(organizationId, phone, input.email);
  if (duplicate) return { id: duplicate.id, created: false };

  const id = randomUUID();
  const { score, stage } = initialScoring(input);
  await getDatabase().insert(leads).values({
    id,
    organizationId,
    name: input.name,
    phone,
    email: input.email,
    source,
    need: input.need,
    location: input.location,
    timeline: input.timeline,
    budget: input.budget != null ? input.budget.toFixed(2) : null,
    decisionMaker: input.decisionMaker ?? null,
    notes: input.notes,
    score,
    stage,
  });
  trackEvent("lead.created", { organizationId, leadId: id, source });
  return { id, created: true };
}

/** Manual add: an existing lead with the same phone or email is a conflict, not a silent merge. */
export async function createManualLead(organizationId: string, input: LeadInput) {
  const result = await createLead(organizationId, input, "MANUAL");
  if (!result.created) {
    throw new LeadInputError(
      "A lead with this phone number or email already exists.",
      409,
      result.id,
    );
  }
  return result;
}

export async function importLeads(organizationId: string, inputs: LeadInput[]) {
  let created = 0;
  let duplicates = 0;
  const seen = new Set<string>();
  for (const input of inputs) {
    const key = `${normalizePhone(input.phone) ?? ""}|${input.email ?? ""}`;
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    const result = await createLead(organizationId, input, "IMPORT");
    if (result.created) created += 1;
    else duplicates += 1;
  }
  return { created, duplicates };
}
