import { importKnowledgeSchema } from "@/lib/validation/knowledge";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { requireKnowledgeManager } from "@/server/knowledge/access";
import { createKnowledgeItems } from "@/server/knowledge/service";

export const runtime = "nodejs";

export const POST = trackRequest("api.knowledge.import", async (request: Request) => {
  try {
    const { membership } = await requireKnowledgeManager(request);
    const input = importKnowledgeSchema.parse(await request.json());
    return Response.json(
      await createKnowledgeItems(membership.organizationId, input.items),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error, "knowledge.import");
  }
});
