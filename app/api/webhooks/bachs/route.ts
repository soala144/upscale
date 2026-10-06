import {
  getBachsWebhookSecret,
  parseBachsWebhook,
  processBachsWebhook,
  verifyBachsWebhookSignature,
} from "@/server/integrations/bachs";
import { captureError, trackRequest } from "@/server/integrations/watchup";
import { logger } from "@/server/logging";

export const runtime = "nodejs";

export const POST = trackRequest(
  "api.webhooks.bachs",
  async (request: Request) => {
    const secret = getBachsWebhookSecret();
    if (!secret) {
      return Response.json(
        { error: "Bachs webhook is not configured" },
        { status: 503 },
      );
    }

    const rawBody = await request.text();
    const signature = request.headers.get("X-Bachs-Signature-V2");
    if (!verifyBachsWebhookSignature(rawBody, signature, secret)) {
      logger.warn("bachs.webhook.rejected_invalid_signature");
      return Response.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    let event;
    try {
      event = parseBachsWebhook(JSON.parse(rawBody));
    } catch {
      return Response.json({ error: "Invalid webhook event" }, { status: 400 });
    }

    try {
      const result = await processBachsWebhook(event);
      return Response.json({ received: true, ...result });
    } catch (error) {
      logger.error("bachs.webhook.processing_failed", {
        eventType: event.type,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
      captureError(error, "bachs.webhook");
      return Response.json(
        { error: "Webhook processing failed" },
        { status: 500 },
      );
    }
  },
);
