import { z } from "zod";

import {
  OrganizationAuthorizationError,
  requireOrganizationMembership,
} from "@/lib/auth/organization-access";
import { updateOrganizationSchema } from "@/lib/validation/organizations";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import {
  getOrganization,
  updateOrganization,
} from "@/server/organizations/service";

type OrganizationRouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = trackRequest(
  "api.organizations.get",
  async (request: Request, { params }: OrganizationRouteContext) => {
    try {
      const { id } = await params;
      const { membership } = await requireOrganizationMembership(request, id);
      const organization = await getOrganization(id, membership.role);

      if (!organization) {
        return Response.json(
          { error: "Organization not found" },
          { status: 404 },
        );
      }

      return Response.json(organization);
    } catch (error) {
      return apiErrorResponse(error, "organizations.get");
    }
  },
);

export const PATCH = trackRequest(
  "api.organizations.update",
  async (request: Request, { params }: OrganizationRouteContext) => {
    try {
      const { id } = await params;
      const { membership } = await requireOrganizationMembership(request, id);

      if (membership.role === "member") {
        throw new OrganizationAuthorizationError(
          403,
          "Organization administrator role required",
        );
      }

      const input = updateOrganizationSchema.parse(await request.json());
      const organization = await updateOrganization(id, input);

      if (!organization) {
        return Response.json(
          { error: "Organization not found" },
          { status: 404 },
        );
      }

      return Response.json(organization);
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }
      return apiErrorResponse(error, "organizations.update");
    }
  },
);
