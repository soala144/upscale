import "server-only";

import { and, eq } from "drizzle-orm";

import { getDatabase } from "@/db";
import { members } from "@/db/schema/organizations";
import { auth } from "@/lib/auth";

export class OrganizationAuthorizationError extends Error {
  constructor(
    public readonly status: 401 | 403 | 409,
    message: string,
  ) {
    super(message);
    this.name = "OrganizationAuthorizationError";
  }
}

async function requireSession(request: Request) {
  const authSession = await auth.api.getSession({ headers: request.headers });

  if (!authSession) {
    throw new OrganizationAuthorizationError(401, "Authentication required");
  }

  return authSession;
}

export async function requireAuthenticatedUser(request: Request) {
  const authSession = await requireSession(request);
  return authSession.user;
}

async function findMembership(
  organizationId: string,
  userId: string,
) {
  const [membership] = await getDatabase()
    .select({
      organizationId: members.organizationId,
      userId: members.userId,
      role: members.role,
    })
    .from(members)
    .where(
      and(
        eq(members.organizationId, organizationId),
        eq(members.userId, userId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new OrganizationAuthorizationError(403, "Organization access denied");
  }

  return membership;
}

export async function requireOrganizationMembership(
  request: Request,
  organizationId: string,
) {
  const authSession = await requireSession(request);
  const membership = await findMembership(
    organizationId,
    authSession.user.id,
  );

  return {
    user: authSession.user,
    session: authSession.session,
    membership,
  };
}

export async function requireActiveOrganizationMembership(request: Request) {
  const authSession = await requireSession(request);

  const organizationId = authSession.session.activeOrganizationId;
  if (!organizationId) {
    throw new OrganizationAuthorizationError(
      409,
      "An active organization is required",
    );
  }

  const membership = await findMembership(organizationId, authSession.user.id);

  return {
    user: authSession.user,
    session: authSession.session,
    membership: {
      ...membership,
    },
  };
}
