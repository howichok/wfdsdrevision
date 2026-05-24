CREATE TABLE "scraped_teams_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"channel_id" text NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "date" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "raw_context" text;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "structured_content" jsonb;--> statement-breakpoint
ALTER TABLE "lessons" ADD COLUMN "status" text DEFAULT 'placeholder' NOT NULL;--> statement-breakpoint
CREATE INDEX "scraped_teams_data_processed_idx" ON "scraped_teams_data" USING btree ("processed");