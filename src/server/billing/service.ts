import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { payments } from "@/db/schema/payments";
import { subscriptions } from "@/db/schema/subscriptions";
import type { SubscriptionPlan } from "@/server/billing/pricing";
import { subscriptionPlans } from "@/server/billing/pricing";
import { createBachsCheckout } from "@/server/integrations/bachs";
import { trackEvent } from "@/server/integrations/watchup";
import { getServerEnv } from "@/lib/env/server";
import { logger, getErrorName } from "@/server/logging";

export class BillingStateError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 409,
  ) {
    super(message);
    this.name = "BillingStateError";
  }
}

async function currentSubscription(organizationId: string) {
  const [subscription] = await getDatabase()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  return subscription ?? null;
}

async function markExpiredTrialPastDue(organizationId: string) {
  const now = new Date();
  const [subscription] = await getDatabase()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.organizationId, organizationId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (
    subscription?.status === "TRIALING" &&
    subscription.trialEnd &&
    subscription.trialEnd <= now
  ) {
    await getDatabase().transaction(async (tx) => {
      await tx
        .update(subscriptions)
        .set({ status: "PAST_DUE", updatedAt: now })
        .where(
          and(
            eq(subscriptions.id, subscription.id),
            eq(subscriptions.status, "TRIALING"),
          ),
        );
      await tx
        .update(organizations)
        .set({ subscriptionStatus: "PAST_DUE", updatedAt: now })
        .where(eq(organizations.id, organizationId));
    });
  }
}

export async function createSubscriptionCheckout(
  organizationId: string,
  planId: SubscriptionPlan,
  customer: { email?: string; name?: string },
) {
  await markExpiredTrialPastDue(organizationId);
  const subscription = await currentSubscription(organizationId);

  if (!subscription) {
    throw new BillingStateError("Subscription not found", 404);
  }
  if (
    subscription.status === "TRIALING" &&
    (!subscription.trialEnd || subscription.trialEnd > new Date())
  ) {
    throw new BillingStateError("Free trial is still active", 409);
  }
  if (subscription.status === "ACTIVE") {
    throw new BillingStateError("Subscription is already active", 409);
  }

  const plan = subscriptionPlans[planId];
  const paymentId = randomUUID();
  const now = new Date();
  const env = getServerEnv();
  const baseUrl = env.BETTER_AUTH_URL;

  await getDatabase().insert(payments).values({
    id: paymentId,
    organizationId,
    type: "SUBSCRIPTION",
    status: "PENDING",
    amount: String(plan.monthlyAmount),
    currency: plan.currency,
    provider: "bachs",
    providerReference: paymentId,
    metadata: { plan: planId },
    createdAt: now,
    updatedAt: now,
  });

  try {
    const checkout = await createBachsCheckout({
      amount: plan.monthlyAmount,
      currency: plan.currency,
      reference: paymentId,
      idempotencyKey: paymentId,
      customer,
      successUrl: new URL("/", baseUrl).toString(),
      cancelUrl: new URL("/", baseUrl).toString(),
      metadata: {
        payment_id: paymentId,
        organization_id: organizationId,
        plan: planId,
      },
    });

    await getDatabase()
      .update(payments)
      .set({
        checkoutId: checkout.checkoutId,
        providerReference: checkout.reference,
        updatedAt: new Date(),
      })
      .where(eq(payments.id, paymentId));

    trackEvent("bachs.checkout.created", {
      organizationId,
      paymentType: "SUBSCRIPTION",
      plan: planId,
      amount: plan.monthlyAmount,
      currency: plan.currency,
    });

    return {
      paymentId,
      checkoutUrl: checkout.checkoutUrl,
      amount: plan.monthlyAmount,
      currency: plan.currency,
    };
  } catch (error) {
    await getDatabase()
      .update(payments)
      .set({ status: "FAILED", updatedAt: new Date() })
      .where(
        and(eq(payments.id, paymentId), eq(payments.status, "PENDING")),
      );
    logger.error("bachs.checkout.failed", {
      organizationId,
      paymentId,
      errorName: getErrorName(error),
    });
    throw error;
  }
}

export async function getSubscriptionState(organizationId: string) {
  await markExpiredTrialPastDue(organizationId);
  const subscription = await currentSubscription(organizationId);

  if (!subscription) {
    throw new BillingStateError("Subscription not found", 404);
  }

  return {
    id: subscription.id,
    plan: subscription.plan,
    status: subscription.status,
    amount: subscription.amount,
    currency: subscription.currency,
    trialStart: subscription.trialStart,
    trialEnd: subscription.trialEnd,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    nextPaymentDue: subscription.nextPaymentDue,
  };
}
