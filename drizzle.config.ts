import type { Config } from "drizzle-kit";
import { existsSync } from "node:fs";
import * as dotenv from "dotenv";

// Netlify/CI: keep platform DATABASE_URL. Only load .env.local for local dev.
if (!process.env.DATABASE_URL?.trim() && existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
}

export default {
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
} satisfies Config;
