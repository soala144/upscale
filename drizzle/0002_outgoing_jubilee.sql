CREATE TABLE "telegram_updates" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"connection_id" text NOT NULL,
	"update_id" bigint NOT NULL,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "telegram_updates" ADD CONSTRAINT "telegram_updates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_updates" ADD CONSTRAINT "telegram_updates_connection_id_telegram_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."telegram_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_updates_connection_update_uidx" ON "telegram_updates" USING btree ("connection_id","update_id");--> statement-breakpoint
CREATE INDEX "telegram_updates_organization_status_idx" ON "telegram_updates" USING btree ("organization_id","status");