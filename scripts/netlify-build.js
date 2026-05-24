#!/usr/bin/env node
/**
 * Netlify build: migrate DB (if DATABASE_URL) → pgvector indexes → next build
 */
const { execSync } = require("child_process");

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env: process.env });
}

async function main() {
  if (process.env.DATABASE_URL) {
    console.log("→ DATABASE_URL set — running migrations…");
    try {
      run("npx drizzle-kit migrate");
      run("node scripts/bootstrap-db.js");
    } catch (err) {
      console.error("\n✗ Database migrate/bootstrap failed.");
      console.error("  Check DATABASE_URL (use Supabase pooler :6543 on Netlify).");
      throw err;
    }
  } else {
    console.warn("\n⚠ DATABASE_URL not set — skipping migrations (offline/demo mode only).");
  }

  run("npx next build");
}

main().catch(() => process.exit(1));
