import "server-only";

import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import { members, organizations } from "@/db/schema/organizations";
import { subscriptions } from "@/db/schema/subscriptions";
import { telegramConnections } from "@/db/schema/telegram-connections";
import type {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "@/lib/validation/organizations";
import { subscriptionPlans, trialDurationDays } from "@/server/billing/pricing";
import { trackEvent } from "@/server/integrations/watchup";

type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export class OrganizationSlugConflictError extends Error {
  constructor() {
    super("Organization slug is already in use");
    this.name = "OrganizationSlugConflictError";
  }
}

export async function createOrganization(
  userId: string,
  input: CreateOrganizationInput,
) {
  const plan = subscriptionPlans[input.plan];
  const trialStart = new Date();
  const trialEnd = new Date(
    trialStart.getTime() + trialDurationDays * 24 * 60 * 60 * 1_000,
  );
  const organizationId = randomUUID();

  let createdOrganization: typeof organizations.$inferSelect;

  try {
    createdOrganization = await getDatabase().transaction(async (tx) => {
      const [organization] = await tx
        .insert(organizations)
        .values({
          id: organizationId,
          name: input.name,
          slug: input.slug,
          industry: input.industry,
          description: input.description,
          notificationEmail: input.notificationEmail,
          plan: input.plan,
          subscriptionStatus: "TRIALING",
        })
        .returning();

      await tx.insert(members).values({
        id: randomUUID(),
        organizationId,
        userId,
        role: "owner",
      });

      await tx.insert(subscriptions).values({
        id: randomUUID(),
        organizationId,
        plan: input.plan,
        status: "TRIALING",
        provider: "upscale",
        amount: String(plan.monthlyAmount),
        currency: plan.currency,
        trialStart,
        trialEnd,
        currentPeriodStart: trialStart,
        currentPeriodEnd: trialEnd,
        nextPaymentDue: trialEnd,
      });

      return organization;
    });
  } catch (error) {
    if (isOrganizationSlugConflict(error)) {
      throw new OrganizationSlugConflictError();
    }

    throw error;
  }

  trackEvent("organization.created", {
    organizationId: createdOrganization.id,
    plan: createdOrganization.plan,
  });
  trackEvent("trial.started", {
    organizationId: createdOrganization.id,
    plan: createdOrganization.plan,
    durationDays: trialDurationDays,
  });

  return toOrganizationResponse(createdOrganization);
}

export async function getOrganization(
  organizationId: string,
  role: "owner" | "admin" | "member",
) {
  const [organization] = await getDatabase()
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      industry: organizations.industry,
      description: organizations.description,
      plan: organizations.plan,
      subscriptionStatus: organizations.subscriptionStatus,
      agentName: organizations.agentName,
      agentPrompt: organizations.agentPrompt,
      notificationEmail: organizations.notificationEmail,
      bachsAccountStatus: organizations.bachsAccountStatus,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    return null;
  }

  const [telegramConnection] = await getDatabase()
    .select({ status: telegramConnections.status })
    .from(telegramConnections)
    .where(
      and(
        eq(telegramConnections.organizationId, organizationId),
        eq(telegramConnections.status, "CONNECTED"),
      ),
    )
    .limit(1);

  const telegramConnected = Boolean(telegramConnection);
  const bachsConnected = ["READY", "CONNECTED"].includes(
    organization.bachsAccountStatus ?? "",
  );

  return {
    ...organization,
    role,
    onboarding: {
      steps: [
        { key: "organization", status: "complete" },
        { key: "telegram", status: telegramConnected ? "complete" : "pending" },
        { key: "bachs", status: bachsConnected ? "complete" : "pending" },
      ],
      currentStep: !bachsConnected
        ? "CONNECT_BACHS"
        : !telegramConnected
          ? "CONNECT_TELEGRAM"
          : "COMPLETE",
    },
  };
}

export async function updateOrganization(
  organizationId: string,
  input: UpdateOrganizationInput,
) {
  try {
    const [organization] = await getDatabase()
      .update(organizations)
      .set({
        ...input,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organizationId))
      .returning({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        industry: organizations.industry,
        description: organizations.description,
        plan: organizations.plan,
        subscriptionStatus: organizations.subscriptionStatus,
        agentName: organizations.agentName,
        agentPrompt: organizations.agentPrompt,
        notificationEmail: organizations.notificationEmail,
        bachsAccountStatus: organizations.bachsAccountStatus,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
      });

    return organization ?? null;
  } catch (error) {
    if (isOrganizationSlugConflict(error)) {
      throw new OrganizationSlugConflictError();
    }

    throw error;
  }
}

function toOrganizationResponse(
  organization: typeof organizations.$inferSelect,
) {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    industry: organization.industry,
    description: organization.description,
    plan: organization.plan,
    subscriptionStatus: organization.subscriptionStatus,
    agentName: organization.agentName,
    agentPrompt: organization.agentPrompt,
    notificationEmail: organization.notificationEmail,
    bachsAccountStatus: organization.bachsAccountStatus,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  };
}

export function isOrganizationSlugConflict(error: unknown): boolean {
  const seen = new Set<Error>();
  let current = error;

  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    if (
      "code" in current &&
      current.code === "23505" &&
      "constraint" in current &&
      current.constraint === "organizations_slug_uidx"
    ) {
      return true;
    }

    current = "cause" in current ? current.cause : undefined;
  }

  return false;
}
