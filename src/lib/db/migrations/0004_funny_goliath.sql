CREATE TABLE "source_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teams_message_id" text NOT NULL,
	"channel_id" uuid NOT NULL,
	"posted_at" timestamp with time zone,
	"sender" text NOT NULL,
	"markdown" text NOT NULL,
	"raw_plain_text" text NOT NULL,
	"attachments" jsonb,
	"lesson_id" uuid,
	"is_processed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teams_messages" ADD COLUMN "posted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'SU' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_single_sa_idx" ON "users" ("role") WHERE "role" = 'SA';--> statement-breakpoint
ALTER TABLE "lesson_recall_nodes" ALTER COLUMN "embedding" SET DATA TYPE vector(768);--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_channel_id_teams_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."teams_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_documents_channel_id_idx" ON "source_documents" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "source_documents_teams_message_id_idx" ON "source_documents" USING btree ("teams_message_id");--> statement-breakpoint
CREATE INDEX "source_documents_lesson_id_idx" ON "source_documents" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "source_documents_is_processed_idx" ON "source_documents" USING btree ("is_processed");