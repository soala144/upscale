import { z } from "zod";

import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { setAiPaused } from "@/server/conversations/takeover";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { getLeadConversation } from "@/server/leads/service";

export const runtime = "nodejs";

type LeadConversationRouteContext = {
  params: Promise<{ id: string }>;
};

export const GET = trackRequest(
  "api.leads.conversation",
  async (
    request: Request,
    context: LeadConversationRouteContext,
  ) => {
    try {
      const { id } = await context.params;
      const { membership } =
        await requireActiveOrganizationMembership(request);
      const conversation = await getLeadConversation(
        membership.organizationId,
        id,
      );
      if (!conversation) {
        return Response.json(
          { error: "Conversation not found" },
          { status: 404 },
        );
      }
      return Response.json({ conversation });
    } catch (error) {
      return apiErrorResponse(error, "leads.conversation");
    }
  },
);

const takeoverSchema = z.object({ aiPaused: z.boolean() });

/** Take over from the assistant (aiPaused true) or hand the chat back (false). */
export const PATCH = trackRequest(
  "api.leads.conversation.takeover",
  async (request: Request, context: LeadConversationRouteContext) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireActiveOrganizationMembership(request);
      const input = takeoverSchema.parse(await request.json());
      return Response.json(await setAiPaused(membership.organizationId, id, input.aiPaused));
    } catch (error) {
      return apiErrorResponse(error, "leads.conversation.takeover");
    }
  },
);
