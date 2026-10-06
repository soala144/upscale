import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, ne } from "drizzle-orm";

import { getDatabase } from "@/db";
import { leads } from "@/db/schema/leads";
import { organizations } from "@/db/schema/organizations";
import { payments } from "@/db/schema/payments";
import { getServerEnv } from "@/lib/env/server";
import {
  createBachsCheckout,
  getBachsConnectedAccount,
  getConnectedAccountState,
} from "@/server/integrations/bachs";
import { BachsApiError } from "@/server/integrations/bachs/client";
import { trackEvent } from "@/server/integrations/watchup";
import { getErrorName, logger } from "@/server/logging";

export class CustomerCheckoutError extends Error {
  constructor(
    message: string,
    public readonly status: 404 | 409,
  ) {
    super(message);
    this.name = "CustomerCheckoutError";
  }
}

export async function createCustomerCheckout(
  organizationId: string,
  input: { leadId: string; amount: number },
) {
  const db = getDatabase();
  const [organization] = await db
    .select({
      id: organizations.id,
      bachsAccountId: organizations.bachsAccountId,
      bachsAccountStatus: organizations.bachsAccountStatus,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new CustomerCheckoutError("Organization not found", 404);
  }
  if (
    !organization.bachsAccountId ||
    organization.bachsAccountStatus !== "READY"
  ) {
    throw new CustomerCheckoutError(
      "Connect and activate a Bachs account before requesting payment",
      409,
    );
  }

  const account = await getBachsConnectedAccount(organization.bachsAccountId);
  if (!getConnectedAccountState(account).ready) {
    await db
      .update(organizations)
      .set({ bachsAccountStatus: "ONBOARDING", updatedAt: new Date() })
      .where(eq(organizations.id, organizationId));
    throw new CustomerCheckoutError(
      "The connected Bachs account is not ready to accept payments",
      409,
    );
  }

  const [lead] = await db
    .select({
      id: leads.id,
      name: leads.name,
      email: leads.email,
      stage: leads.stage,
    })
    .from(leads)
    .where(
      and(
        eq(leads.id, input.leadId),
        eq(leads.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!lead) {
    throw new CustomerCheckoutError("Lead not found", 404);
  }
  if (lead.stage === "CONVERTED") {
    throw new CustomerCheckoutError("Lead is already converted", 409);
  }

  const paymentId = randomUUID();
  const amount = input.amount.toFixed(2);
  await db.insert(payments).values({
    id: paymentId,
    organizationId,
    leadId: lead.id,
    type: "CUSTOMER_PURCHASE",
    status: "PENDING",
    amount,
    currency: "NGN",
    provider: "bachs",
    providerAccountId: organization.bachsAccountId,
    providerReference: paymentId,
    platformFee: "0",
    metadata: { kind: "customer_purchase" },
  });

  const baseUrl = getServerEnv().BETTER_AUTH_URL;
  let checkout: Awaited<ReturnType<typeof createBachsCheckout>>;
  try {
    checkout = await createBachsCheckout({
      amount: input.amount,
      currency: "NGN",
      reference: paymentId,
      idempotencyKey: paymentId,
      accountId: organization.bachsAccountId,
      customer: {
        email: lead.email || undefined,
        name: lead.name?.trim() || undefined,
      },
      successUrl: new URL("/payments", baseUrl).toString(),
      cancelUrl: new URL("/payments", baseUrl).toString(),
      metadata: {
        payment_id: paymentId,
        organization_id: organizationId,
        lead_id: lead.id,
      },
    });
  } catch (error) {
    if (error instanceof BachsApiError && error.status < 500) {
      await db
        .update(payments)
        .set({ status: "FAILED", updatedAt: new Date() })
        .where(and(eq(payments.id, paymentId), eq(payments.status, "PENDING")));
    }
    logger.error("bachs.customer_checkout.failed", {
      organizationId,
      paymentId,
      errorName: getErrorName(error),
    });
    throw error;
  }

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        checkoutId: checkout.checkoutId,
        providerReference: checkout.reference,
        updatedAt: new Date(),
      })
      .where(and(eq(payments.id, paymentId), eq(payments.status, "PENDING")));
    await tx
      .update(leads)
      .set({ stage: "PAYMENT_PENDING", updatedAt: new Date() })
      .where(
        and(
          eq(leads.id, lead.id),
          eq(leads.organizationId, organizationId),
          ne(leads.stage, "CONVERTED"),
        ),
      );
  });

  trackEvent("bachs.checkout.created", {
    organizationId,
    paymentType: "CUSTOMER_PURCHASE",
    leadId: lead.id,
    amount: input.amount,
    currency: "NGN",
  });

  return {
    paymentId,
    checkoutUrl: checkout.checkoutUrl,
    amount,
    currency: "NGN" as const,
  };
}

export async function listOrganizationPayments(organizationId: string) {
  return getDatabase()
    .select({
      id: payments.id,
      leadId: payments.leadId,
      type: payments.type,
      status: payments.status,
      amount: payments.amount,
      currency: payments.currency,
      checkoutId: payments.checkoutId,
      providerReference: payments.providerReference,
      platformFee: payments.platformFee,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt,
    })
    .from(payments)
    .where(eq(payments.organizationId, organizationId))
    .orderBy(desc(payments.createdAt))
    .limit(100);
}
