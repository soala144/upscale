import { consentSchema } from "@/lib/validation/broadcast";
import { requireBroadcastManager } from "@/server/broadcast/access";
import { setLeadBroadcastConsent } from "@/server/broadcast/service";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

export const PATCH = trackRequest(
  "api.leads.broadcast_consent",
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireBroadcastManager(request);
      const input = consentSchema.parse(await request.json());
      return Response.json(
        await setLeadBroadcastConsent(membership.organizationId, id, input.optedOut),
      );
    } catch (error) {
      return apiErrorResponse(error, "leads.broadcast_consent");
    }
  },
);
