import { z } from "zod";

import {
  OrganizationAuthorizationError,
  requireActiveOrganizationMembership,
} from "@/lib/auth/organization-access";
import { connectTelegramSchema } from "@/lib/validation/telegram";
import { apiErrorResponse } from "@/server/http/api-errors";
import { trackRequest } from "@/server/integrations/watchup";
import { connectTelegram } from "@/server/telegram/service";

export const runtime = "nodejs";

export const POST = trackRequest(
  "api.telegram.connect",
  async (request: Request) => {
    try {
      const { membership } =
        await requireActiveOrganizationMembership(request);
      if (!["owner", "admin"].includes(membership.role)) {
        throw new OrganizationAuthorizationError(
          403,
          "Organization administrator access required",
        );
      }

      const input = connectTelegramSchema.parse(await request.json());
      const connection = await connectTelegram(
        membership.organizationId,
        input.botToken,
      );

      return Response.json({ connection }, { status: 201 });
    } catch (error) {
      if (error instanceof z.ZodError || error instanceof SyntaxError) {
        return Response.json({ error: "Invalid request" }, { status: 400 });
      }
      return apiErrorResponse(error, "telegram.connect");
    }
  },
);
