#!/usr/bin/env node
/**
 * Enable pgvector and create HNSW indexes after migrations.
 * Usage: dotenv -e .env.local -- node scripts/bootstrap-db.js
 */
const { Pool } = require("pg");

const INDEXES = [
  {
    name: "embeddings_embedding_hnsw_idx",
    sql: `CREATE INDEX IF NOT EXISTS embeddings_embedding_hnsw_idx
      ON embeddings USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)`,
  },
  {
    name: "lesson_recall_nodes_embedding_hnsw_idx",
    sql: `CREATE INDEX IF NOT EXISTS lesson_recall_nodes_embedding_hnsw_idx
      ON lesson_recall_nodes USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
      WHERE embedding IS NOT NULL`,
  },
  {
    name: "ai_semantic_cache_embedding_hnsw_idx",
    sql: `CREATE INDEX IF NOT EXISTS ai_semantic_cache_embedding_hnsw_idx
      ON ai_semantic_cache USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)`,
  },
  {
    name: "user_error_memory_embedding_hnsw_idx",
    sql: `CREATE INDEX IF NOT EXISTS user_error_memory_embedding_hnsw_idx
      ON user_error_memory USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
      WHERE embedding IS NOT NULL`,
  },
  {
    name: "spec_atoms_embedding_hnsw_idx",
    sql: `CREATE INDEX IF NOT EXISTS spec_atoms_embedding_hnsw_idx
      ON spec_atoms USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 64)
      WHERE embedding IS NOT NULL`,
  },
];

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    console.log("→ Enabling pgvector extension…");
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");

    for (const index of INDEXES) {
      try {
        console.log(`→ Creating index ${index.name}…`);
        await pool.query(index.sql);
        console.log(`  ✓ ${index.name}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("does not exist")) {
          console.log(`  ⊘ Skipped ${index.name} (table not migrated yet)`);
        } else {
          throw err;
        }
      }
    }

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(`\n✓ Database ready (${tables.rowCount} public tables)`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Bootstrap failed:", err.message || err);
  process.exit(1);
});
