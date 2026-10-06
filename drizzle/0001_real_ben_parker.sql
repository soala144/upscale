CREATE TABLE "bachs_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "provider_reference" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "next_payment_due" timestamp with time zone;--> statement-breakpoint
UPDATE "subscriptions"
SET "next_payment_due" = COALESCE("trial_end", "current_period_end")
WHERE "next_payment_due" IS NULL
	AND "status" IN ('TRIALING', 'ACTIVE', 'PAST_DUE');--> statement-breakpoint
CREATE INDEX "bachs_webhook_events_processed_at_idx" ON "bachs_webhook_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX "subscriptions_provider_reference_idx" ON "subscriptions" USING btree ("provider","provider_reference");