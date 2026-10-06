import "server-only";

import { addMonths } from "date-fns";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import { bachsWebhookEvents } from "@/db/schema/bachs-webhook-events";
import { leads } from "@/db/schema/leads";
import { organizations } from "@/db/schema/organizations";
import { payments } from "@/db/schema/payments";
import { subscriptions } from "@/db/schema/subscriptions";
import { getServerEnv } from "@/lib/env/server";
import {
  getBachsConnectedAccount,
  getConnectedAccountState,
} from "@/server/integrations/bachs/accounts";
import { trackEvent } from "@/server/integrations/watchup";

import { bachsWebhookSchema, type BachsWebhook } from "./types";

const subscriptionPaymentMetadataSchema = z.object({
  plan: z.enum(["BASIC", "GROWTH", "SCALE"]),
});

function parseAmount(amount: string | number | undefined) {
  if (typeof amount === "number" && Number.isFinite(amount)) {
    return amount.toFixed(2);
  }
  if (typeof amount === "string" && /^\d+(?:\.\d{1,2})?$/.test(amount)) {
    return Number(amount).toFixed(2);
  }
  return null;
}

export function parseBachsWebhook(body: unknown): BachsWebhook {
  return bachsWebhookSchema.parse(body);
}

export async function processBachsWebhook(event: BachsWebhook) {
  if (
    event.type === "account.updated" ||
    event.type === "capability.updated"
  ) {
    return processBachsConnectEvent(event);
  }

  if (!["collection.succeeded", "collection.failed"].includes(event.type)) {
    return { ignored: true, duplicate: false };
  }

  const checkoutId = event.data.checkout_id;
  const reference = event.data.reference;
  if (!checkoutId && !reference) {
    throw new Error("Bachs collection event has no payment reference");
  }

  const paymentLookup =
    checkoutId && reference
      ? and(
          eq(payments.checkoutId, checkoutId),
          eq(payments.providerReference, reference),
        )
      : checkoutId
        ? eq(payments.checkoutId, checkoutId)
        : eq(payments.providerReference, reference!);
  const db = getDatabase();
  const result = await db.transaction(async (tx) => {
    const [payment] = await tx
      .select()
      .from(payments)
      .where(
        and(eq(payments.provider, "bachs"), paymentLookup),
      )
      .limit(1);

    if (!payment) {
      throw new Error("Bachs collection event did not match a payment");
    }
    const eventAccountId = event.account ?? event.data.account;
    if (
      payment.type === "CUSTOMER_PURCHASE" &&
      eventAccountId &&
      payment.providerAccountId !== eventAccountId
    ) {
      throw new Error("Bachs collection event account does not match payment");
    }

    const amount = parseAmount(event.data.amount);
    if (
      !amount ||
      amount !== Number(payment.amount).toFixed(2) ||
      (event.data.currency ?? "").toUpperCase() !== payment.currency
    ) {
      throw new Error("Bachs collection amount does not match the payment");
    }

    const [receivedEvent] = await tx
      .insert(bachsWebhookEvents)
      .values({ id: event.id, eventType: event.type })
      .onConflictDoNothing()
      .returning({ id: bachsWebhookEvents.id });

    if (!receivedEvent) {
      return {
        ignored: false,
        duplicate: true,
        payment: null,
        convertedLeadId: null,
      };
    }

    if (payment.status !== "PENDING") {
      return {
        ignored: false,
        duplicate: true,
        payment: null,
        convertedLeadId: null,
      };
    }

    const now = new Date();
    const nextStatus = event.type === "collection.succeeded" ? "PAID" : "FAILED";
    const [updatedPayment] = await tx
      .update(payments)
      .set({ status: nextStatus, updatedAt: now })
      .where(and(eq(payments.id, payment.id), eq(payments.status, "PENDING")))
      .returning({
        id: payments.id,
        organizationId: payments.organizationId,
        type: payments.type,
        status: payments.status,
      });

    if (!updatedPayment) {
      return {
        ignored: false,
        duplicate: true,
        payment: null,
        convertedLeadId: null,
      };
    }

    let convertedLeadId: string | null = null;
    if (payment.type === "SUBSCRIPTION") {
      if (nextStatus === "PAID") {
        const metadata = subscriptionPaymentMetadataSchema.safeParse(
          payment.metadata,
        );
        if (!metadata.success) {
          throw new Error("Subscription payment metadata is invalid");
        }

        const [subscription] = await tx
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.organizationId, payment.organizationId))
          .orderBy(subscriptions.createdAt)
          .limit(1);

        if (!subscription) {
          throw new Error("Subscription payment has no subscription");
        }

        const periodStart =
          subscription.currentPeriodEnd &&
          subscription.currentPeriodEnd > now
            ? subscription.currentPeriodEnd
            : now;
        const periodEnd = addMonths(periodStart, 1);

        await tx
          .update(subscriptions)
          .set({
            plan: metadata.data.plan,
            status: "ACTIVE",
            provider: "bachs",
            providerReference: reference ?? payment.providerReference,
            amount: payment.amount,
            currency: payment.currency,
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
            nextPaymentDue: periodEnd,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, subscription.id));
        await tx
          .update(organizations)
          .set({
            plan: metadata.data.plan,
            subscriptionStatus: "ACTIVE",
            updatedAt: now,
          })
          .where(eq(organizations.id, payment.organizationId));
      } else {
        await tx
          .update(subscriptions)
          .set({ status: "PAST_DUE", updatedAt: now })
          .where(eq(subscriptions.organizationId, payment.organizationId));
        await tx
          .update(organizations)
          .set({ subscriptionStatus: "PAST_DUE", updatedAt: now })
          .where(eq(organizations.id, payment.organizationId));
      }
    } else if (nextStatus === "PAID" && payment.leadId) {
      const [convertedLead] = await tx
        .update(leads)
        .set({ stage: "CONVERTED", updatedAt: now })
        .where(
          and(
            eq(leads.id, payment.leadId),
            eq(leads.organizationId, payment.organizationId),
            ne(leads.stage, "CONVERTED"),
          ),
        )
        .returning({ id: leads.id });
      convertedLeadId = convertedLead?.id ?? null;
    }

    return {
      ignored: false,
      duplicate: false,
      payment: updatedPayment,
      convertedLeadId,
    };
  });

  if (result.payment) {
    trackEvent(
      result.payment.status === "PAID"
        ? "bachs.payment.succeeded"
        : "bachs.payment.failed",
      {
        organizationId: result.payment.organizationId,
        paymentType: result.payment.type,
      },
    );
  }
  if (result.payment && result.convertedLeadId) {
    trackEvent("lead.converted", {
      organizationId: result.payment.organizationId,
      leadId: result.convertedLeadId,
    });
  }

  return {
    ignored: result.ignored,
    duplicate: result.duplicate,
  };
}

async function processBachsConnectEvent(event: BachsWebhook) {
  const accountId =
    event.account ?? event.data.account ?? event.organization_id;
  if (!accountId) {
    return { ignored: true, duplicate: false };
  }

  const [organization] = await getDatabase()
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.bachsAccountId, accountId))
    .limit(1);
  if (!organization) {
    return { ignored: true, duplicate: false };
  }

  const account = await getBachsConnectedAccount(accountId);
  const { ready } = getConnectedAccountState(account);
  const applied = await getDatabase().transaction(async (tx) => {
    const [receivedEvent] = await tx
      .insert(bachsWebhookEvents)
      .values({ id: event.id, eventType: event.type })
      .onConflictDoNothing()
      .returning({ id: bachsWebhookEvents.id });

    if (!receivedEvent) {
      return false;
    }

    await tx
      .update(organizations)
      .set({
        bachsAccountStatus: ready ? "READY" : "ONBOARDING",
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, organization.id));
    return true;
  });

  if (!applied) {
    return { ignored: false, duplicate: true };
  }

  trackEvent("bachs.connect.status_updated", {
    organizationId: organization.id,
    accountStatus: ready ? "READY" : "ONBOARDING",
  });

  return { ignored: false, duplicate: false };
}

export function getBachsWebhookSecret() {
  return getServerEnv().BACHS_WEBHOOK_SECRET;
}
