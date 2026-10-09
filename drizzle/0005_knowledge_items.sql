CREATE TYPE "public"."knowledge_kind" AS ENUM('PRODUCT', 'FAQ');--> statement-breakpoint
CREATE TABLE "knowledge_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" "knowledge_kind" NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"price" numeric(14, 2),
	"currency" text DEFAULT 'NGN' NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_items_organization_kind_idx" ON "knowledge_items" USING btree ("organization_id","kind");