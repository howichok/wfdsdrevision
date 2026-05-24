#!/usr/bin/env node
/**
 * One-command local setup: env → Docker Postgres → migrate → pgvector indexes
 */
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const { Pool } = require("pg");

const ENV_PATH = ".env.local";

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", ...opts });
}

function loadDatabaseUrl() {
  if (!fs.existsSync(ENV_PATH)) return null;
  for (const line of fs.readFileSync(ENV_PATH, "utf8").split("\n")) {
    const t = line.trim();
    if (t.startsWith("DATABASE_URL=")) {
      const val = t.slice("DATABASE_URL=".length);
      return val || null;
    }
  }
  return null;
}

function hasDocker() {
  const r = spawnSync("docker", ["info"], { stdio: "ignore" });
  return r.status === 0;
}

async function waitForPostgres(url, attempts = 30) {
  for (let i = 0; i < attempts; i++) {
    const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 2000 });
    try {
      await pool.query("SELECT 1");
      await pool.end();
      return true;
    } catch {
      await pool.end().catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return false;
}

async function main() {
  console.log("╔══════════════════════════════════════╗");
  console.log("║   ReviseAI — full local setup        ║");
  console.log("╚══════════════════════════════════════╝\n");

  // 1. Env defaults
  run("node scripts/generate-env.js");

  const dbUrl = loadDatabaseUrl();
  const useLocalDocker =
    dbUrl &&
    (dbUrl.includes("localhost") ||
      dbUrl.includes("127.0.0.1") ||
      dbUrl.includes("@db:5432"));

  // 2. Docker Postgres (local URL only)
  if (useLocalDocker) {
    if (!hasDocker()) {
      console.warn("\n⚠ Docker not available — start Postgres manually or use Supabase DATABASE_URL.");
    } else {
      run("docker compose up -d db");
      console.log("\n→ Waiting for Postgres…");
      const ready = await waitForPostgres(dbUrl);
      if (!ready) {
        console.error("Postgres did not become ready in time.");
        process.exit(1);
      }
      console.log("✓ Postgres is ready");
    }
  }

  // 3. Migrations
  try {
    run("npx dotenv -e .env.local -- drizzle-kit migrate");
  } catch {
    console.error("\n✗ Migration failed.");
    if (useLocalDocker) {
      console.error("  → Install Docker Desktop, then run: npm run setup");
      console.error("  → Or paste a Supabase DATABASE_URL into .env.local and run: npm run setup:db");
    } else {
      console.error("  → Check DATABASE_URL in .env.local and that Postgres is reachable.");
      console.error("  → Then run: npm run setup:db");
    }
    process.exit(1);
  }

  // 4. pgvector + indexes
  run("npx dotenv -e .env.local -- node scripts/bootstrap-db.js");

  // 5. Status
  run("npx dotenv -e .env.local -- node scripts/setup-env.js");

  console.log("\n════════════════════════════════════════");
  console.log("Setup complete. Next steps:");
  console.log("  1. npm run dev");
  console.log("  2. Open http://localhost:3000/login");
  console.log("  3. Sign up, then either:");
  console.log("     • Set BOOTSTRAP_SA_EMAIL=you@email.com in .env.local before signup, or");
  console.log("     • npm run seed:sa -- your@email.com");
  console.log("\nOptional — add to .env.local for full AI features:");
  console.log("  GOOGLE_GENERATIVE_AI_API_KEY  → https://aistudio.google.com/apikey");
  console.log("  QSTASH_*                      → Upstash (dev works without)");
  console.log("════════════════════════════════════════\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
