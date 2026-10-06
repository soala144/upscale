import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { BachsApiError, bachsGet, bachsRequest } from "./client";

const connectedAccountSchema = z
  .object({
    id: z.string().min(1),
    capabilities: z
      .record(
        z.string(),
        z.object({ status: z.string() }).passthrough(),
      )
      .optional(),
    requirements: z
      .object({
        currently_due: z.array(z.string()).default([]),
        past_due: z.array(z.string()).default([]),
        errors: z.array(z.unknown()).default([]),
      })
      .optional(),
  })
  .passthrough();

const accountLinkSchema = z
  .object({
    url: z.string().url(),
  })
  .passthrough();

export type ConnectedAccount = z.infer<typeof connectedAccountSchema>;

export function getConnectedAccountState(account: ConnectedAccount) {
  const capabilities = account.capabilities ?? {};
  const capabilityStatus = {
    ngnCardCollection:
      capabilities.ngn_card_collection?.status ?? "unrequested",
    bankTransfer: capabilities.bank_transfer?.status ?? "unrequested",
  };
  const ready = Object.values(capabilityStatus).some(
    (status) => status === "active",
  );
  const requirements = account.requirements;
  const onboardingRequired = Boolean(
    requirements &&
      (requirements.currently_due.length > 0 ||
        requirements.past_due.length > 0 ||
        requirements.errors.length > 0),
  );

  return {
    ready,
    onboardingRequired,
    capabilityStatus,
  };
}

export async function createBachsConnectedAccount(input: {
  organizationId: string;
  displayName: string;
  contactEmail: string;
}) {
  const account = await bachsRequest(
    "/v1/accounts",
    `upscale-connect-${input.organizationId}`,
    {
      contact_email: input.contactEmail,
      display_name: input.displayName,
      country: "NG",
      entity_type: "company",
      configuration: {
        merchant: {
          capabilities: {
            ngn_card_collection: { requested: true },
            bank_transfer: { requested: true },
          },
        },
      },
    },
    (payload) => connectedAccountSchema.parse(payload),
  );
  return account;
}

export function getBachsConnectedAccount(accountId: string) {
  return bachsGet(
    `/v1/accounts/${encodeURIComponent(accountId)}`,
    (payload) => connectedAccountSchema.parse(payload),
  );
}

export async function createBachsAccountLink(
  accountId: string,
  type: "onboarding" | "update",
  baseUrl: string,
) {
  const response = await bachsRequest(
    `/v1/accounts/${encodeURIComponent(accountId)}/account-links`,
    randomUUID(),
    {
      type,
      refresh_url: new URL("/?bachs=refresh", baseUrl).toString(),
      return_url: new URL("/?bachs=return", baseUrl).toString(),
    },
    (payload) => accountLinkSchema.parse(payload),
  );
  const url = new URL(response.url);
  if (url.protocol !== "https:" || url.hostname !== "connect.bachs.io") {
    throw new BachsApiError(
      "Bachs returned an invalid account onboarding URL",
      502,
    );
  }
  return url.toString();
}
