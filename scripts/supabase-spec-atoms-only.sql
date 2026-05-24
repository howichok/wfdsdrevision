-- ═══════════════════════════════════════════════════════════════════════════════
-- ReviseAI — SPEC ATOMS ONLY (safe for existing databases)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Run this in Supabase → SQL Editor when you ALREADY have users, documents, etc.
-- Do NOT re-run scripts/supabase-sql-editor.sql on an existing DB — it will error
-- with "relation already exists".
--
-- After this SQL succeeds, import atom rows from your machine:
--   npm run spec:import:only
-- (with DATABASE_URL pointing at this Supabase project)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS vector;

-- ── 1. Pathways (anchor root) ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS spec_pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  slug text NOT NULL,
  name text NOT NULL,
  alias text,
  spec_version text NOT NULL,
  structure jsonb,
  meta jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT spec_pathways_slug_unique UNIQUE (slug)
);

-- ── 2. Atoms (the 208 spec units live HERE after npm run spec:import) ─────────
CREATE TABLE IF NOT EXISTS spec_atoms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  pathway_id uuid NOT NULL,
  external_id text NOT NULL,
  legacy_id text,
  component_slug text NOT NULL,
  module_slug text NOT NULL,
  learning_outcome_id text,
  atom_kind text DEFAULT 'knowledge' NOT NULL,
  title text NOT NULL,
  statement text NOT NULL,
  keywords jsonb DEFAULT '[]'::jsonb NOT NULL,
  bloom_level text,
  assessment_criteria jsonb,
  prerequisites jsonb DEFAULT '[]'::jsonb NOT NULL,
  evidence_types jsonb DEFAULT '[]'::jsonb NOT NULL,
  source_refs jsonb,
  metadata jsonb,
  needs_human_review boolean DEFAULT false NOT NULL,
  embedding vector(768),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- ── 3. Prerequisite / relationship graph ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS spec_atom_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  pathway_id uuid NOT NULL,
  from_atom_id uuid NOT NULL,
  to_atom_id uuid NOT NULL,
  edge_type text DEFAULT 'prerequisite' NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ── 4. Teams / lesson evidence → atom links (empty until linker runs) ──────────
CREATE TABLE IF NOT EXISTS evidence_atom_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  atom_id uuid NOT NULL,
  source_type text NOT NULL,
  source_id text NOT NULL,
  link_type text NOT NULL,
  confidence integer,
  excerpt text,
  metadata jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- ── Foreign keys (idempotent) ────────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE spec_atoms
    ADD CONSTRAINT spec_atoms_pathway_id_spec_pathways_id_fk
    FOREIGN KEY (pathway_id) REFERENCES spec_pathways(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE spec_atom_edges
    ADD CONSTRAINT spec_atom_edges_pathway_id_spec_pathways_id_fk
    FOREIGN KEY (pathway_id) REFERENCES spec_pathways(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE spec_atom_edges
    ADD CONSTRAINT spec_atom_edges_from_atom_id_spec_atoms_id_fk
    FOREIGN KEY (from_atom_id) REFERENCES spec_atoms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE spec_atom_edges
    ADD CONSTRAINT spec_atom_edges_to_atom_id_spec_atoms_id_fk
    FOREIGN KEY (to_atom_id) REFERENCES spec_atoms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE evidence_atom_links
    ADD CONSTRAINT evidence_atom_links_atom_id_spec_atoms_id_fk
    FOREIGN KEY (atom_id) REFERENCES spec_atoms(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS spec_pathways_slug_idx ON spec_pathways (slug);
CREATE INDEX IF NOT EXISTS spec_atoms_pathway_id_idx ON spec_atoms (pathway_id);
CREATE INDEX IF NOT EXISTS spec_atoms_external_id_idx ON spec_atoms (external_id);
CREATE INDEX IF NOT EXISTS spec_atoms_component_module_idx ON spec_atoms (component_slug, module_slug);
CREATE INDEX IF NOT EXISTS spec_atoms_pathway_external_unique_idx ON spec_atoms (pathway_id, external_id);
CREATE INDEX IF NOT EXISTS spec_atom_edges_from_atom_idx ON spec_atom_edges (from_atom_id);
CREATE INDEX IF NOT EXISTS spec_atom_edges_to_atom_idx ON spec_atom_edges (to_atom_id);
CREATE INDEX IF NOT EXISTS evidence_atom_links_atom_id_idx ON evidence_atom_links (atom_id);
CREATE INDEX IF NOT EXISTS evidence_atom_links_source_idx ON evidence_atom_links (source_type, source_id);

CREATE INDEX IF NOT EXISTS spec_atoms_embedding_hnsw_idx
  ON spec_atoms USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE embedding IS NOT NULL;

-- ── Verify (run after import) ────────────────────────────────────────────────
-- SELECT COUNT(*) AS atom_count FROM spec_atoms;
-- SELECT component_slug, COUNT(*) FROM spec_atoms GROUP BY 1;
-- SELECT slug, name FROM spec_pathways;
