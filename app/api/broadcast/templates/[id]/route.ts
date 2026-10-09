import { templateInputSchema } from "@/lib/validation/broadcast";
import { requireBroadcastManager } from "@/server/broadcast/access";
import { deleteTemplate, updateTemplate } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export const PATCH = trackRequest(
  "api.broadcast.templates.update",
  async (request: Request, context: Context) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireBroadcastManager(request);
      const input = templateInputSchema.parse(await request.json());
      await updateTemplate(membership.organizationId, id, input);
      return Response.json({ ok: true });
    } catch (error) {
      return apiErrorResponse(error, "broadcast.templates.update");
    }
  },
);

export const DELETE = trackRequest(
  "api.broadcast.templates.delete",
  async (request: Request, context: Context) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireBroadcastManager(request);
      await deleteTemplate(membership.organizationId, id);
      return Response.json({ ok: true });
    } catch (error) {
      return apiErrorResponse(error, "broadcast.templates.delete");
    }
  },
);
