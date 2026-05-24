#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

// Load .env.local when run directly (npm run setup:env uses dotenv-cli too)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const val = trimmed.slice(eq + 1);
    if (!(key in process.env) || process.env[key] === "") {
      process.env[key] = val;
    }
  }
}

const vars = [
  {
    group: "Database (Supabase / PostgreSQL)",
    vars: [
      {
        name: "DATABASE_URL",
        example: "postgresql://user:pass@db.xxxx.supabase.co:5432/postgres",
        note: "Supabase direct connection URL (Settings → Database → Connection string)",
      },
      {
        name: "NEXT_PUBLIC_SUPABASE_URL",
        example: "https://xxxx.supabase.co",
        note: "Supabase project URL (Settings → API)",
      },
      {
        name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        example: "eyJh...",
        note: "Supabase anonymous public key (Settings → API)",
      },
      {
        name: "SUPABASE_SERVICE_ROLE_KEY",
        example: "eyJh...",
        note: "Server-only — NEVER expose to client (Settings → API)",
      },
    ],
  },
  {
    group: "Google AI (Gemini)",
    vars: [
      {
        name: "GOOGLE_GENERATIVE_AI_API_KEY",
        example: "AIza...",
        note: "From https://aistudio.google.com/apikey",
      },
    ],
  },
  {
    group: "Authentication (better-auth + Google OAuth)",
    vars: [
      {
        name: "BETTER_AUTH_SECRET",
        example: "random-32-char-string",
        note: "Generate with: openssl rand -base64 32",
      },
      {
        name: "GOOGLE_CLIENT_ID",
        example: "xxxx.apps.googleusercontent.com",
        note: "Google Cloud Console → APIs & Services → Credentials → OAuth 2.0",
      },
      {
        name: "GOOGLE_CLIENT_SECRET",
        example: "GOCSPX-...",
        note: "Google Cloud Console → OAuth 2.0 client secret",
      },
    ],
  },
  {
    group: "Upstash QStash (Job Queues)",
    vars: [
      {
        name: "QSTASH_TOKEN",
        example: "eyJV...",
        note: "Upstash Console → QStash → API Keys",
      },
      {
        name: "QSTASH_CURRENT_SIGNING_KEY",
        example: "sig_...",
        note: "QStash webhook signature verification — current key",
      },
      {
        name: "QSTASH_NEXT_SIGNING_KEY",
        example: "sig_...",
        note: "QStash webhook signature verification — next key (for rotation)",
      },
    ],
  },
  {
    group: "Upstash Redis",
    vars: [
      {
        name: "UPSTASH_REDIS_REST_URL",
        example: "https://xxx-xxx.upstash.io",
        note: "Upstash Console → Redis → REST API → Endpoint",
      },
      {
        name: "UPSTASH_REDIS_REST_TOKEN",
        example: "AXxx...",
        note: "Upstash Console → Redis → REST API → Token",
      },
    ],
  },
  {
    group: "Application",
    vars: [
      {
        name: "NEXT_PUBLIC_APP_URL",
        example: "http://localhost:3000",
        note: "Public base URL — used for QStash webhook callback URLs",
      },
      {
        name: "NEXT_PUBLIC_ENABLE_LOGIN_SKIP",
        example: "true",
        note: "Show Skip login button (recommended for local dev)",
        optional: true,
      },
    ],
  },
];

const R = "\x1b[0m";
const B = "\x1b[1m";
const G = "\x1b[32m";
const Y = "\x1b[33m";
const C = "\x1b[36m";
const D = "\x1b[2m";

console.log(`\n${B}╔═══════════════════════════════════════════════╗${R}`);
console.log(`${B}║   Required Environment Variables Checklist    ║${R}`);
console.log(`${B}╚═══════════════════════════════════════════════╝${R}`);
console.log(`${D}  Copy values into .env.local and fill them in.${R}\n`);

let missing = 0;
let found = 0;

for (const group of vars) {
  console.log(`${C}${B}▸ ${group.group}${R}`);
  for (const v of group.vars) {
    const raw = process.env[v.name];
    const ok = !!raw && raw.length > 0;
    if (ok) found++;
    else missing++;
    const status = ok
      ? `${G}[✓] SET   ${R}`
      : raw === ""
        ? `${Y}[ ] EMPTY ${R}`
        : `${Y}[ ] MISSING${R}`;
    console.log(`  ${status} ${B}${v.name}${R}${v.optional ? ` ${D}(optional)${R}` : ""}`);
    console.log(`            ${D}Example : ${v.example}${R}`);
    console.log(`            ${D}Note    : ${v.note}${R}`);
  }
  console.log();
}

const total = found + missing;
const bar = "█".repeat(Math.round((found / total) * 20)) + "░".repeat(20 - Math.round((found / total) * 20));
const pct = Math.round((found / total) * 100);
console.log(`${B}Progress: [${found === total ? G : Y}${bar}${R}${B}] ${pct}% (${found}/${total})${R}`);

if (missing === 0) {
  console.log(`\n${G}${B}✓ All environment variables are set. You're ready to run!${R}\n`);
} else {
  console.log(`\n${Y}${B}⚠  ${missing} variable${missing > 1 ? "s" : ""} still need${missing === 1 ? "s" : ""} to be set in .env.local${R}\n`);
}
