import { requireActiveOrganizationMembership } from "@/lib/auth/organization-access";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { getTelegramConnectionStatus } from "@/server/telegram/service";

export const runtime = "nodejs";

export const GET = trackRequest(
  "api.telegram.status",
  async (request: Request) => {
    try {
      const { membership } =
        await requireActiveOrganizationMembership(request);
      const connection = await getTelegramConnectionStatus(
        membership.organizationId,
      );
      return Response.json({
        connection: connection
          ? {
              ...connection,
              connected: connection.status === "CONNECTED",
            }
          : null,
      });
    } catch (error) {
      return apiErrorResponse(error, "telegram.status");
    }
  },
);
