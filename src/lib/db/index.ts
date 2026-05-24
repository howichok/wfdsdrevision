import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL?.trim();

function normalizeDatabaseUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  let normalized = url;
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

const poolConnectionString =
  normalizeDatabaseUrl(connectionString) ?? "postgresql://localhost:5432/reviseai";

if (!connectionString) {
  console.warn("[db] DATABASE_URL is not set — auth and server routes will fail.");
}

const pool = new Pool({
  connectionString: poolConnectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  ssl: poolConnectionString.includes("supabase.com")
    ? { rejectUnauthorized: false }
    : undefined,
});

export const db = drizzle(pool, { schema });
export type DB = typeof db;
