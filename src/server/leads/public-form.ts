import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { telegramConnections } from "@/db/schema/telegram-connections";

/** Only what a visitor needs: the business name and, if connected, the bot to continue in. */
export async function getPublicFormContext(slug: string) {
  const [organization] = await getDatabase()
    .select({ id: organizations.id, name: organizations.name, description: organizations.description })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);
  if (!organization) return null;

  const [bot] = await getDatabase()
    .select({ username: telegramConnections.botUsername, status: telegramConnections.status })
    .from(telegramConnections)
    .where(eq(telegramConnections.organizationId, organization.id))
    .limit(1);

  return {
    organizationId: organization.id,
    name: organization.name,
    description: organization.description,
    botUsername: bot?.status === "CONNECTED" ? bot.username : null,
  };
}

const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60_000;
const MAX_HITS = 8;

/** Best-effort per-instance throttle for the public endpoint (IP + business). */
export function allowPublicSubmission(key: string, now = Date.now()) {
  const recent = (hits.get(key) ?? []).filter((time) => now - time < WINDOW_MS);
  if (recent.length >= MAX_HITS) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5_000) hits.clear();
  return true;
}
