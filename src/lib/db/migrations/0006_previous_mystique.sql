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
--> statement-breakpoint
CREATE TABLE "spec_atom_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pathway_id" uuid NOT NULL,
	"from_atom_id" uuid NOT NULL,
	"to_atom_id" uuid NOT NULL,
	"edge_type" text DEFAULT 'prerequisite' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "evidence_atom_links" ADD CONSTRAINT "evidence_atom_links_atom_id_spec_atoms_id_fk" FOREIGN KEY ("atom_id") REFERENCES "public"."spec_atoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spec_atom_edges" ADD CONSTRAINT "spec_atom_edges_pathway_id_spec_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "public"."spec_pathways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spec_atom_edges" ADD CONSTRAINT "spec_atom_edges_from_atom_id_spec_atoms_id_fk" FOREIGN KEY ("from_atom_id") REFERENCES "public"."spec_atoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spec_atom_edges" ADD CONSTRAINT "spec_atom_edges_to_atom_id_spec_atoms_id_fk" FOREIGN KEY ("to_atom_id") REFERENCES "public"."spec_atoms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spec_atoms" ADD CONSTRAINT "spec_atoms_pathway_id_spec_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "public"."spec_pathways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_atom_links_atom_id_idx" ON "evidence_atom_links" USING btree ("atom_id");--> statement-breakpoint
CREATE INDEX "evidence_atom_links_source_idx" ON "evidence_atom_links" USING btree ("source_type","source_id");--> statement-breakpoint
CREATE INDEX "spec_atom_edges_from_atom_idx" ON "spec_atom_edges" USING btree ("from_atom_id");--> statement-breakpoint
CREATE INDEX "spec_atom_edges_to_atom_idx" ON "spec_atom_edges" USING btree ("to_atom_id");--> statement-breakpoint
CREATE INDEX "spec_atoms_pathway_id_idx" ON "spec_atoms" USING btree ("pathway_id");--> statement-breakpoint
CREATE INDEX "spec_atoms_external_id_idx" ON "spec_atoms" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "spec_atoms_component_module_idx" ON "spec_atoms" USING btree ("component_slug","module_slug");--> statement-breakpoint
CREATE INDEX "spec_atoms_pathway_external_unique_idx" ON "spec_atoms" USING btree ("pathway_id","external_id");--> statement-breakpoint
CREATE INDEX "spec_pathways_slug_idx" ON "spec_pathways" USING btree ("slug");