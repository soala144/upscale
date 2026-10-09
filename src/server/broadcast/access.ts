import "server-only";

import {
  OrganizationAuthorizationError,
  requireActiveOrganizationMembership,
} from "@/lib/auth/organization-access";

/** Owners and admins may create, send and cancel; members are read-only. */
export async function requireBroadcastManager(request: Request) {
  const context = await requireActiveOrganizationMembership(request);
  if (!["owner", "admin"].includes(context.membership.role)) {
    throw new OrganizationAuthorizationError(
      403,
      "Organization administrator access required",
    );
  }
  return context;
}
