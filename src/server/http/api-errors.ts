import "server-only";

import { ZodError } from "zod";

import { OrganizationAuthorizationError } from "@/lib/auth/organization-access";
import { captureError } from "@/server/integrations/watchup";
import { TelegramApiError } from "@/server/integrations/telegram";
import { BachsApiError } from "@/server/integrations/bachs/client";
import { getErrorName, logger } from "@/server/logging";
import { BillingStateError } from "@/server/billing/service";
import {
  BachsAccountNotFoundError,
  BachsConnectInputError,
} from "@/server/organizations/bachs-connect";
import { TelegramConnectionError } from "@/server/telegram/service";
import { OrganizationSlugConflictError } from "@/server/organizations/service";
import { CustomerCheckoutError } from "@/server/payments/service";

export function apiErrorResponse(error: unknown, area: string): Response {
  if (error instanceof OrganizationAuthorizationError) {
    return Response.json(
      { error: error.message },
      { status: error.status },
    );
  }

  if (error instanceof OrganizationSlugConflictError) {
    return Response.json({ error: error.message }, { status: 409 });
  }

  if (error instanceof BillingStateError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof CustomerCheckoutError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof BachsAccountNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }

  if (error instanceof BachsConnectInputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  if (error instanceof TelegramConnectionError) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof TelegramApiError) {
    if (error.status === 400) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    logger.error("telegram.api.request_failed", { area });
    captureError(error, area);
    return Response.json(
      { error: "Telegram is temporarily unavailable" },
      { status: 502 },
    );
  }

  if (error instanceof BachsApiError) {
    if (error.status === 503) {
      return Response.json(
        { error: "Bachs integration is not configured" },
        { status: 503 },
      );
    }
    logger.error("bachs.api.request.failed", {
      area,
      status: error.status,
    });
    captureError(error, area);
    return Response.json(
      { error: "Bachs API is temporarily unavailable" },
      { status: 502 },
    );
  }

  if (error instanceof ZodError || error instanceof SyntaxError) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  logger.error("api.request.failed", {
    area,
    errorName: getErrorName(error),
  });
  captureError(error, area);

  return Response.json({ error: "Internal server error" }, { status: 500 });
}
