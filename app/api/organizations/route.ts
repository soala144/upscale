import { requireAuthenticatedUser } from "@/lib/auth/organization-access";
import { createOrganizationSchema } from "@/lib/validation/organizations";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { createOrganization } from "@/server/organizations/service";

export const POST = trackRequest(
  "api.organizations.create",
  async (request: Request) => {
    try {
      const user = await requireAuthenticatedUser(request);
      const input = createOrganizationSchema.parse(await request.json());
      const organization = await createOrganization(user.id, input);

      return Response.json(organization, { status: 201 });
    } catch (error) {
      return apiErrorResponse(error, "organizations.create");
    }
  },
);
