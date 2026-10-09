import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { knowledgeItemSchema } from "@/lib/validation/knowledge";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { requireKnowledgeManager } from "@/server/knowledge/access";
import { createKnowledgeItems, listKnowledge } from "@/server/knowledge/service";

export const runtime = "nodejs";

export const GET = trackRequest("api.knowledge.list", async (request: Request) => {
  try {
    const { membership } = await requireActiveOrganizationMembership(request);
    return Response.json({ items: await listKnowledge(membership.organizationId) });
  } catch (error) {
    return apiErrorResponse(error, "knowledge.list");
  }
});

export const POST = trackRequest("api.knowledge.create", async (request: Request) => {
  try {
    const { membership } = await requireKnowledgeManager(request);
    const input = knowledgeItemSchema.parse(await request.json());
    return Response.json(
      await createKnowledgeItems(membership.organizationId, [input]),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "knowledge.create");
  }
});
