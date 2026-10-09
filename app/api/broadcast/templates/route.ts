import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { templateInputSchema } from "@/lib/validation/broadcast";
import { requireBroadcastManager } from "@/server/broadcast/access";
import { createTemplate, listTemplates } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

export const GET = trackRequest("api.broadcast.templates.list", async (request: Request) => {
  try {
    const { membership } = await requireActiveOrganizationMembership(request);
    return Response.json({ templates: await listTemplates(membership.organizationId) });
  } catch (error) {
    return apiErrorResponse(error, "broadcast.templates.list");
  }
});

export const POST = trackRequest("api.broadcast.templates.create", async (request: Request) => {
  try {
    const { membership, user } = await requireBroadcastManager(request);
    const input = templateInputSchema.parse(await request.json());
    const template = await createTemplate(membership.organizationId, user.id, input);
    return Response.json({ template }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "broadcast.templates.create");
  }
});
