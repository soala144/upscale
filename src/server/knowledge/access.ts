import "server-only";

import {
  OrganizationAuthorizationError,
  requireActiveOrganizationMembership,
} from "@/lib/auth/organization-access";

/** Knowledge shapes what the bot says to customers, so only owners and admins may edit it. */
export async function requireKnowledgeManager(request: Request) {
  const context = await requireActiveOrganizationMembership(request);
  if (!["owner", "admin"].includes(context.membership.role)) {
    throw new OrganizationAuthorizationError(403, "Organization administrator access required");
  }
  return context;
}
