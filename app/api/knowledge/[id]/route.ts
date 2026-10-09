import { knowledgeItemSchema } from "@/lib/validation/knowledge";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { requireKnowledgeManager } from "@/server/knowledge/access";
import { deleteKnowledgeItem, updateKnowledgeItem } from "@/server/knowledge/service";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export const PATCH = trackRequest(
  "api.knowledge.update",
  async (request: Request, context: Context) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireKnowledgeManager(request);
      const input = knowledgeItemSchema.parse(await request.json());
      await updateKnowledgeItem(membership.organizationId, id, input);
      return Response.json({ ok: true });
    } catch (error) {
      return apiErrorResponse(error, "knowledge.update");
    }
  },
);

export const DELETE = trackRequest(
  "api.knowledge.delete",
  async (request: Request, context: Context) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireKnowledgeManager(request);
      await deleteKnowledgeItem(membership.organizationId, id);
      return Response.json({ ok: true });
    } catch (error) {
      return apiErrorResponse(error, "knowledge.delete");
    }
  },
);
