import "server-only";

import { eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { organizations } from "@/db/schema/organizations";
import { getServerEnv } from "@/lib/env/server";
import {
  createBachsAccountLink,
  createBachsConnectedAccount,
  getBachsConnectedAccount,
  getConnectedAccountState,
} from "@/server/integrations/bachs";
import { trackEvent } from "@/server/integrations/watchup";

export class BachsAccountNotFoundError extends Error {
  constructor() {
    super("Bachs account not found");
    this.name = "BachsAccountNotFoundError";
  }
}

export class BachsConnectInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BachsConnectInputError";
  }
}

export async function startBachsConnect(
  organizationId: string,
  user: { email: string; name: string },
) {
  const [organization] = await getDatabase()
    .select({
      id: organizations.id,
      name: organizations.name,
      notificationEmail: organizations.notificationEmail,
      bachsAccountId: organizations.bachsAccountId,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new BachsAccountNotFoundError();
  }

  const contactEmail = organization.notificationEmail ?? user.email;
  if (!contactEmail) {
    throw new BachsConnectInputError(
      "Add a notification email before connecting Bachs",
    );
  }

  let account;
  let isNewAccount = false;
  if (organization.bachsAccountId) {
    account = await getBachsConnectedAccount(organization.bachsAccountId);
  } else {
    isNewAccount = true;
    account = await createBachsConnectedAccount({
        organizationId,
        displayName: organization.name,
        contactEmail,
    });
  }
  const accountState = getConnectedAccountState(account);
  const status = accountState.ready ? "READY" : "ONBOARDING";

  await getDatabase()
    .update(organizations)
    .set({
      bachsAccountId: account.id,
      bachsAccountStatus: status,
      updatedAt: new Date(),
    })
    .where(eq(organizations.id, organizationId));

  const onboardingUrl = accountState.onboardingRequired
    ? await createBachsAccountLink(
        account.id,
        isNewAccount ? "onboarding" : "update",
        getServerEnv().BETTER_AUTH_URL,
      )
    : null;

  trackEvent("bachs.connect.started", {
    organizationId,
    accountStatus: status,
  });

  return {
    accountId: account.id,
    status,
    capabilities: accountState.capabilityStatus,
    onboardingUrl,
  };
}

export async function getBachsConnectStatus(organizationId: string) {
  const [organization] = await getDatabase()
    .select({
      accountId: organizations.bachsAccountId,
      status: organizations.bachsAccountStatus,
    })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new BachsAccountNotFoundError();
  }

  return {
    accountId: organization.accountId,
    status: organization.status ?? "NOT_CONNECTED",
  };
}
