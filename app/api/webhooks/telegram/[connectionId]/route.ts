import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDatabase } from "@/db";
import { telegramConnections } from "@/db/schema/telegram-connections";
import { telegramUpdates } from "@/db/schema/telegram-updates";
import { verifyTelegramWebhookSecret } from "@/lib/crypto/telegram-token";
import { telegramUpdateSchema } from "@/lib/validation/telegram";
import {
  captureError,
  trackEvent,
  trackRequest,
} from "@/server/integrations/watchup";
import { getErrorName, logger } from "@/server/logging";
import { processTelegramUpdate } from "@/server/telegram/webhook-service";

export const runtime = "nodejs";

export const POST = trackRequest(
  "api.webhooks.telegram",
  async (
    request: Request,
    context: RouteContext<"/api/webhooks/telegram/[connectionId]">,
  ) => {
    const { connectionId } = await context.params;
    try {
      const [connection] = await getDatabase()
        .select()
        .from(telegramConnections)
        .where(eq(telegramConnections.id, connectionId))
        .limit(1);

      if (!connection) {
        return Response.json(
          { error: "Telegram connection not found" },
          { status: 404 },
        );
      }

      if (
        !verifyTelegramWebhookSecret(
          request.headers.get("X-Telegram-Bot-Api-Secret-Token"),
          connection.webhookSecretHash,
        )
      ) {
        logger.warn("telegram.webhook.rejected_invalid_secret", {
          connectionId,
        });
        return Response.json(
          { error: "Invalid webhook secret" },
          { status: 401 },
        );
      }

      if (!["CONNECTED", "PENDING"].includes(connection.status)) {
        return Response.json({ received: true, ignored: true });
      }

      let update: z.infer<typeof telegramUpdateSchema>;
      try {
        update = telegramUpdateSchema.parse(await request.json());
      } catch (error) {
        if (error instanceof z.ZodError || error instanceof SyntaxError) {
          return Response.json(
            { error: "Invalid Telegram update" },
            { status: 400 },
          );
        }
        throw error;
      }

      const [receivedUpdate] = await getDatabase()
        .insert(telegramUpdates)
        .values({
          id: randomUUID(),
          organizationId: connection.organizationId,
          connectionId: connection.id,
          updateId: update.update_id,
          status: "RECEIVED",
        })
        .onConflictDoNothing()
        .returning({ id: telegramUpdates.id });

      if (receivedUpdate && update.message) {
        trackEvent("telegram.message.received", {
          organizationId: connection.organizationId,
          connectionId: connection.id,
        });
      }

      const result = await processTelegramUpdate(connection, update);
      return Response.json({
        received: true,
        duplicate: !receivedUpdate || result.duplicate === true,
        ...result,
      });
    } catch (error) {
      logger.error("telegram.webhook.failed", {
        connectionId,
        errorName: getErrorName(error),
      });
      captureError(error, "telegram.webhook");
      trackEvent("telegram.webhook.failed", { connectionId });
      return Response.json(
        { error: "Telegram webhook processing failed" },
        { status: 500 },
      );
    }
  },
);
