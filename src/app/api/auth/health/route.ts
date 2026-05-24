import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/auth/health — quick prod debug (no secrets returned). */
export async function GET() {
  const checks: Record<string, boolean | string | number> = {
    databaseUrlSet: Boolean(process.env.DATABASE_URL?.trim()),
    authSecretSet: Boolean(process.env.BETTER_AUTH_SECRET?.trim()),
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "(not set)",
    netlifyUrl: process.env.URL ?? "(not set)",
  };

  try {
    await db.execute(sql`SELECT 1`);
    checks.databaseConnect = true;

    const tables = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('users', 'accounts', 'sessions', 'verifications')
    `);
    const names = (tables.rows as { table_name: string }[]).map((row) => row.table_name);
    checks.authTables = names.join(",");
    checks.authTablesOk = names.length === 4;

    const userCols = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name IN ('role', 'email_verified')
    `);
    checks.userAuthColumnsOk = userCols.rows.length >= 2;
  } catch (error) {
    checks.databaseConnect = false;
    checks.databaseError = error instanceof Error ? error.message : "unknown";
  }

  const ok =
    checks.databaseUrlSet === true &&
    checks.authSecretSet === true &&
    checks.databaseConnect === true &&
    checks.authTablesOk === true &&
    checks.userAuthColumnsOk === true;

  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
