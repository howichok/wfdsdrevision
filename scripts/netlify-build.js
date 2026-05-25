#!/usr/bin/env node
/**
 * Netlify build: optional DB migrate → pgvector indexes → next build
 *
 * Production Supabase was often bootstrapped via SQL editor, so
 * drizzle.__drizzle_migrations may be empty while tables already exist.
 * In that case we skip drizzle-kit migrate and only run bootstrap indexes.
 */
const { execSync } = require("child_process");
const { Pool } = require("pg");

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

function normalizeDatabaseUrl(url) {
  if (!url) return undefined;
  let normalized = url.trim();
  if (
    normalized.includes("pooler.supabase.com") &&
    (normalized.includes(":6543") || process.env.SUPABASE_POOLER === "transaction")
  ) {
    if (!normalized.includes("pgbouncer=")) {
      normalized += normalized.includes("?") ? "&pgbouncer=true" : "?pgbouncer=true";
    }
  }
  return normalized;
}

function poolConfig() {
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);
  return {
    connectionString,
    connectionTimeoutMillis: 15_000,
    ssl: connectionString?.includes("supabase.com")
      ? { rejectUnauthorized: false }
      : undefined,
  };
}

async function isSchemaAlreadyPresent() {
  const pool = new Pool(poolConfig());
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'users'
      ) AS present
    `);
    return result.rows[0]?.present === true;
  } finally {
    await pool.end();
  }
}

async function main() {
  if (process.env.DATABASE_URL?.trim()) {
    const schemaPresent = await isSchemaAlreadyPresent();

    if (schemaPresent) {
      console.log(
        "→ Public schema already present (users table) — skipping drizzle-kit migrate."
      );
      console.log(
        "  Tip: if you add new migrations locally, run them once against Supabase,",
      );
      console.log(
        "  or baseline drizzle.__drizzle_migrations before relying on CI migrate.",
      );
    } else {
      console.log("→ Fresh database — running drizzle-kit migrate…");
      try {
        run("npx drizzle-kit migrate");
      } catch (err) {
        console.error("\n✗ drizzle-kit migrate failed.");
        console.error("  Check DATABASE_URL (use Supabase transaction pooler :6543).");
        throw err;
      }
    }

    try {
      run("node scripts/bootstrap-db.js");
    } catch (err) {
      console.error("\n✗ bootstrap-db failed (pgvector indexes).");
      throw err;
    }
  } else {
    console.warn("\n⚠ DATABASE_URL not set — skipping migrations (offline/demo mode only).");
  }

  run("npx next build");
}

main().catch(() => process.exit(1));
