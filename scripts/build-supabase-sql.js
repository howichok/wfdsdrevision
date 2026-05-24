#!/usr/bin/env node
/**
 * Regenerate scripts/supabase-sql-editor.sql from Drizzle migrations.
 * Usage: node scripts/build-supabase-sql.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "src/lib/db/migrations");
const JOURNAL_PATH = path.join(MIGRATIONS_DIR, "meta/_journal.json");
const OUT_PATH = path.join(ROOT, "scripts/supabase-sql-editor.sql");

const HNSW_INDEXES = `
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
`.trim();

const SA_SECTION = `
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
`.trim();

function stripBreakpoints(sql) {
  return sql
    .split("\n")
    .map((line) => line.replace(/\s*--> statement-breakpoint\s*$/, ""))
    .join("\n")
    .trim();
}

function main() {
  const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, "utf8"));
  const entries = journal.entries.sort((a, b) => a.idx - b.idx);

  const migrationBlocks = entries.map((entry) => {
    const filePath = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing migration file: ${entry.tag}.sql`);
    }
    const raw = fs.readFileSync(filePath, "utf8");
    const sql = stripBreakpoints(raw);
    return `-- ── ${entry.tag}.sql ──\n${sql}`;
  });

  const header = `-- ═══════════════════════════════════════════════════════════════════════════════
-- ReviseAI — Supabase SQL Editor bootstrap (FULL SCHEMA)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Generated: ${new Date().toISOString().slice(0, 10)} from src/lib/db/migrations/
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
`;

  const body = migrationBlocks.join("\n\n");

  const footer = `
${HNSW_INDEXES}

${SA_SECTION}
`;

  const output = `${header}\n${body}\n${footer}\n`;
  fs.writeFileSync(OUT_PATH, output);
  console.log(`✓ Wrote ${OUT_PATH}`);
  console.log(`  Migrations: ${entries.map((e) => e.tag).join(", ")}`);
}

main();
