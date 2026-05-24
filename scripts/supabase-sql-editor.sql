-- ═══════════════════════════════════════════════════════════════════════════════
-- ReviseAI — Supabase SQL Editor bootstrap (FULL SCHEMA)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Generated: 2026-05-24 from src/lib/db/migrations/
-- Regenerate: node scripts/build-supabase-sql.js
--
-- WHERE: Supabase Dashboard → SQL → New query → paste ALL → Run
--
-- USE ON: Empty / fresh Supabase project ONLY.
-- If tables already exist (error: relation "documents" already exists), STOP.
--   → Use scripts/supabase-spec-atoms-only.sql instead (spec tables only)
--   → Verify with scripts/supabase-verify-spec.sql
--
-- If you already ran npm run db:migrate, skip table creation — run HNSW + SA only.
--
-- ORDER:
--   1. pgvector extension
--   2. Migrations 0000–0005 (all tables, FKs, indexes)
--   3. HNSW vector indexes
--   4. Promote SA (after signup)
--
-- EASIER ALTERNATIVE: npm run setup:db  (uses DATABASE_URL + Drizzle migrate)
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Step 1: pgvector (required before vector columns) ───────────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Step 2: Drizzle migrations ────────────────────────────────────────────────

-- ── 0000_square_mojo.sql ──
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'Untitled' NOT NULL,
	"content" text DEFAULT '',
	"content_json" jsonb,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" vector(768) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"subject" text DEFAULT 'Computer Science' NOT NULL,
	"teacher_name" text DEFAULT 'Dr. Elizabeth Vance' NOT NULL,
	"attachments" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic_id" uuid NOT NULL,
	"title" text NOT NULL,
	"text" text NOT NULL,
	"type" text DEFAULT 'essay' NOT NULL,
	"grading_criteria" jsonb,
	"sample_answer" text,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "queue_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"qstash_message_id" text,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "queue_jobs_qstash_message_id_unique" UNIQUE("qstash_message_id")
);

CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"user_answer" text NOT NULL,
	"score" integer,
	"feedback" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"marked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "teams_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_id" uuid NOT NULL,
	"teams_channel_id" text NOT NULL,
	"channel_name" text NOT NULL,
	"team_name" text,
	"is_synced" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "teams_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"teams_message_id" text NOT NULL,
	"sender" text NOT NULL,
	"content" text NOT NULL,
	"attachments" jsonb,
	"is_processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "teams_sync_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"cookies" jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "questions" ADD CONSTRAINT "questions_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "teams_channels" ADD CONSTRAINT "teams_channels_config_id_teams_sync_configs_id_fk" FOREIGN KEY ("config_id") REFERENCES "public"."teams_sync_configs"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "teams_messages" ADD CONSTRAINT "teams_messages_channel_id_teams_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."teams_channels"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "teams_sync_configs" ADD CONSTRAINT "teams_sync_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "documents_user_id_idx" ON "documents" USING btree ("user_id");
CREATE INDEX "embeddings_document_id_idx" ON "embeddings" USING btree ("document_id");
CREATE INDEX "questions_topic_id_idx" ON "questions" USING btree ("topic_id");
CREATE INDEX "queue_jobs_status_idx" ON "queue_jobs" USING btree ("status");
CREATE INDEX "queue_jobs_type_idx" ON "queue_jobs" USING btree ("type");
CREATE INDEX "submissions_user_id_idx" ON "submissions" USING btree ("user_id");
CREATE INDEX "submissions_question_id_idx" ON "submissions" USING btree ("question_id");
CREATE INDEX "teams_channels_config_id_idx" ON "teams_channels" USING btree ("config_id");
CREATE INDEX "teams_messages_channel_id_idx" ON "teams_messages" USING btree ("channel_id");
CREATE INDEX "teams_sync_configs_user_id_idx" ON "teams_sync_configs" USING btree ("user_id");

-- ── 0001_foamy_sauron.sql ──
CREATE TABLE "scraped_teams_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"channel_id" text NOT NULL,
	"scraped_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed" boolean DEFAULT false NOT NULL
);

ALTER TABLE "lessons" ADD COLUMN "date" timestamp with time zone DEFAULT now();
ALTER TABLE "lessons" ADD COLUMN "raw_context" text;
ALTER TABLE "lessons" ADD COLUMN "structured_content" jsonb;
ALTER TABLE "lessons" ADD COLUMN "status" text DEFAULT 'placeholder' NOT NULL;
CREATE INDEX "scraped_teams_data_processed_idx" ON "scraped_teams_data" USING btree ("processed");

-- ── 0002_regular_vulcan.sql ──
CREATE TABLE "ai_semantic_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_text" text NOT NULL,
	"embedding" vector(384) NOT NULL,
	"response_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lesson_challenge_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_code" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lesson_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"language" text NOT NULL,
	"starter_code" text NOT NULL,
	"test_suite" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "lesson_recall_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lesson_id" uuid NOT NULL,
	"node_type" text NOT NULL,
	"key" text NOT NULL,
	"summary" text NOT NULL,
	"metadata" jsonb,
	"embedding" vector(384),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "user_error_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"concept" text NOT NULL,
	"error_context" text NOT NULL,
	"embedding" vector(384),
	"mastery_score" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "lesson_challenge_submissions" ADD CONSTRAINT "lesson_challenge_submissions_challenge_id_lesson_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."lesson_challenges"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "lesson_challenge_submissions" ADD CONSTRAINT "lesson_challenge_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "lesson_challenges" ADD CONSTRAINT "lesson_challenges_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "lesson_recall_nodes" ADD CONSTRAINT "lesson_recall_nodes_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "lesson_challenge_submissions_challenge_user_idx" ON "lesson_challenge_submissions" USING btree ("challenge_id","user_id");
CREATE INDEX "lesson_challenges_lesson_id_idx" ON "lesson_challenges" USING btree ("lesson_id");
CREATE INDEX "lesson_recall_nodes_lesson_id_idx" ON "lesson_recall_nodes" USING btree ("lesson_id");

-- ── 0003_yummy_ikaris.sql ──
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);

CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "lesson_challenges" ADD COLUMN "user_id" uuid;
ALTER TABLE "lessons" ADD COLUMN "user_id" uuid;
ALTER TABLE "scraped_teams_data" ADD COLUMN "user_id" uuid;
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "image" text;
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "accounts_user_id_idx" ON "accounts" USING btree ("user_id");
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");
ALTER TABLE "lesson_challenges" ADD CONSTRAINT "lesson_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "scraped_teams_data" ADD CONSTRAINT "scraped_teams_data_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "lesson_challenges_user_id_idx" ON "lesson_challenges" USING btree ("user_id");
CREATE INDEX "lessons_user_id_idx" ON "lessons" USING btree ("user_id");
CREATE INDEX "scraped_teams_data_user_id_idx" ON "scraped_teams_data" USING btree ("user_id");

-- ── 0004_funny_goliath.sql ──
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

ALTER TABLE "teams_messages" ADD COLUMN "posted_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'SU' NOT NULL;
CREATE UNIQUE INDEX "users_single_sa_idx" ON "users" ("role") WHERE "role" = 'SA';
ALTER TABLE "lesson_recall_nodes" ALTER COLUMN "embedding" SET DATA TYPE vector(768);
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_channel_id_teams_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."teams_channels"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "source_documents" ADD CONSTRAINT "source_documents_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "source_documents_channel_id_idx" ON "source_documents" USING btree ("channel_id");
CREATE INDEX "source_documents_teams_message_id_idx" ON "source_documents" USING btree ("teams_message_id");
CREATE INDEX "source_documents_lesson_id_idx" ON "source_documents" USING btree ("lesson_id");
CREATE INDEX "source_documents_is_processed_idx" ON "source_documents" USING btree ("is_processed");

-- ── 0005_chief_darkstar.sql ──
CREATE TABLE "user_devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"fingerprint" text NOT NULL,
	"device_label" text NOT NULL,
	"browser" text,
	"os" text,
	"last_ip_address" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_trusted" boolean DEFAULT false NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "lesson_recall_nodes" ALTER COLUMN "embedding" SET DATA TYPE vector(768);
ALTER TABLE "sessions" ADD COLUMN "impersonated_by" text;
ALTER TABLE "sessions" ADD COLUMN "device_label" text;
ALTER TABLE "sessions" ADD COLUMN "device_fingerprint" text;
ALTER TABLE "sessions" ADD COLUMN "user_device_id" uuid;
ALTER TABLE "sessions" ADD COLUMN "last_active_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN "banned" boolean DEFAULT false NOT NULL;
ALTER TABLE "users" ADD COLUMN "ban_reason" text;
ALTER TABLE "users" ADD COLUMN "ban_expires" timestamp with time zone;
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "user_devices_user_id_idx" ON "user_devices" USING btree ("user_id");
CREATE INDEX "user_devices_fingerprint_idx" ON "user_devices" USING btree ("user_id","fingerprint");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_device_id_user_devices_id_fk" FOREIGN KEY ("user_device_id") REFERENCES "public"."user_devices"("id") ON DELETE set null ON UPDATE no action;
CREATE INDEX "sessions_user_device_id_idx" ON "sessions" USING btree ("user_device_id");

-- ── 0006_previous_mystique.sql ──
CREATE TABLE "evidence_atom_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"atom_id" uuid NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"link_type" text NOT NULL,
	"confidence" integer,
	"excerpt" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "spec_atom_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pathway_id" uuid NOT NULL,
	"from_atom_id" uuid NOT NULL,
	"to_atom_id" uuid NOT NULL,
	"edge_type" text DEFAULT 'prerequisite' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "spec_atoms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pathway_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"legacy_id" text,
	"component_slug" text NOT NULL,
	"module_slug" text NOT NULL,
	"learning_outcome_id" text,
	"atom_kind" text DEFAULT 'knowledge' NOT NULL,
	"title" text NOT NULL,
	"statement" text NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"bloom_level" text,
	"assessment_criteria" jsonb,
	"prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"evidence_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_refs" jsonb,
	"metadata" jsonb,
	"needs_human_review" boolean DEFAULT false NOT NULL,
	"embedding" vector(768),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "spec_pathways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"alias" text,
	"spec_version" text NOT NULL,
	"structure" jsonb,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spec_pathways_slug_unique" UNIQUE("slug")
);

ALTER TABLE "evidence_atom_links" ADD CONSTRAINT "evidence_atom_links_atom_id_spec_atoms_id_fk" FOREIGN KEY ("atom_id") REFERENCES "public"."spec_atoms"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "spec_atom_edges" ADD CONSTRAINT "spec_atom_edges_pathway_id_spec_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "public"."spec_pathways"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "spec_atom_edges" ADD CONSTRAINT "spec_atom_edges_from_atom_id_spec_atoms_id_fk" FOREIGN KEY ("from_atom_id") REFERENCES "public"."spec_atoms"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "spec_atom_edges" ADD CONSTRAINT "spec_atom_edges_to_atom_id_spec_atoms_id_fk" FOREIGN KEY ("to_atom_id") REFERENCES "public"."spec_atoms"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "spec_atoms" ADD CONSTRAINT "spec_atoms_pathway_id_spec_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "public"."spec_pathways"("id") ON DELETE cascade ON UPDATE no action;
CREATE INDEX "evidence_atom_links_atom_id_idx" ON "evidence_atom_links" USING btree ("atom_id");
CREATE INDEX "evidence_atom_links_source_idx" ON "evidence_atom_links" USING btree ("source_type","source_id");
CREATE INDEX "spec_atom_edges_from_atom_idx" ON "spec_atom_edges" USING btree ("from_atom_id");
CREATE INDEX "spec_atom_edges_to_atom_idx" ON "spec_atom_edges" USING btree ("to_atom_id");
CREATE INDEX "spec_atoms_pathway_id_idx" ON "spec_atoms" USING btree ("pathway_id");
CREATE INDEX "spec_atoms_external_id_idx" ON "spec_atoms" USING btree ("external_id");
CREATE INDEX "spec_atoms_component_module_idx" ON "spec_atoms" USING btree ("component_slug","module_slug");
CREATE INDEX "spec_atoms_pathway_external_unique_idx" ON "spec_atoms" USING btree ("pathway_id","external_id");
CREATE INDEX "spec_pathways_slug_idx" ON "spec_pathways" USING btree ("slug");

-- ── HNSW vector indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS embeddings_embedding_hnsw_idx
  ON embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS lesson_recall_nodes_embedding_hnsw_idx
  ON lesson_recall_nodes USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS ai_semantic_cache_embedding_hnsw_idx
  ON ai_semantic_cache USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS user_error_memory_embedding_hnsw_idx
  ON user_error_memory USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

CREATE INDEX IF NOT EXISTS spec_atoms_embedding_hnsw_idx
  ON spec_atoms USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

-- ── Promote Special Admin (run AFTER first signup at /login) ─────────────────
-- Replace YOUR_EMAIL@example.com, uncomment, and run this block only.
--
-- UPDATE users
-- SET role = 'SA', updated_at = NOW()
-- WHERE email = 'YOUR_EMAIL@example.com'
--   AND NOT EXISTS (
--     SELECT 1 FROM users WHERE role = 'SA' AND email <> 'YOUR_EMAIL@example.com'
--   );
--
-- SELECT id, email, role FROM users WHERE role = 'SA';
--
-- Alternatives:
--   • Set BOOTSTRAP_SA_EMAIL in Netlify/local env before signup (auto SA)
--   • npm run seed:sa -- your@email.com
--   • scripts/promote-sa.sql

