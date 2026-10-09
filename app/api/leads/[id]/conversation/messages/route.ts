import { z } from "zod";

import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { sendHumanReply } from "@/server/conversations/takeover";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";

export const runtime = "nodejs";

const replySchema = z.object({ content: z.string().min(1).max(4096) });

/** Sends a reply written by a team member to the customer on Telegram. */
export const POST = trackRequest(
  "api.leads.conversation.reply",
  async (request: Request, context: { params: Promise<{ id: string }> }) => {
    try {
      const { id } = await context.params;
      const { membership } = await requireActiveOrganizationMembership(request);
      const input = replySchema.parse(await request.json());
      const result = await sendHumanReply(membership.organizationId, id, input.content);
      return Response.json(result, { status: 201 });
    } catch (error) {
      return apiErrorResponse(error, "leads.conversation.reply");
    }
  },
);
