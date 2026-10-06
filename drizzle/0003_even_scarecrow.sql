ALTER TABLE "telegram_updates" ADD COLUMN "lead_id" text;--> statement-breakpoint
ALTER TABLE "telegram_updates" ADD COLUMN "conversation_id" text;--> statement-breakpoint
ALTER TABLE "telegram_updates" ADD COLUMN "user_message_id" text;--> statement-breakpoint
ALTER TABLE "telegram_updates" ADD COLUMN "assistant_message_id" text;--> statement-breakpoint
ALTER TABLE "telegram_updates" ADD COLUMN "processing_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "telegram_updates" ADD CONSTRAINT "telegram_updates_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_updates" ADD CONSTRAINT "telegram_updates_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_updates" ADD CONSTRAINT "telegram_updates_user_message_id_messages_id_fk" FOREIGN KEY ("user_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_updates" ADD CONSTRAINT "telegram_updates_assistant_message_id_messages_id_fk" FOREIGN KEY ("assistant_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;