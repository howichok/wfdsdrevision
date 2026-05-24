import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamsSyncConfigs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  requireSpecialAdmin,
  AuthError,
  authErrorResponse,
} from "@/lib/auth/permissions";

export async function POST(req: NextRequest) {
  try {
    const saUser = await requireSpecialAdmin();
    const { cookies } = await req.json();

    if (!cookies) {
      return NextResponse.json({ error: "Missing cookies field" }, { status: 400 });
    }

    let parsedCookies: unknown[];
    try {
      parsedCookies = typeof cookies === "string" ? JSON.parse(cookies) : cookies;
      if (!Array.isArray(parsedCookies)) throw new Error();
    } catch {
      return NextResponse.json(
        { error: "Cookies must be a valid JSON array" },
        { status: 400 }
      );
    }

    const existing = await db.query.teamsSyncConfigs.findFirst({
      where: eq(teamsSyncConfigs.userId, saUser.id),
    });

    if (existing) {
      await db
        .update(teamsSyncConfigs)
        .set({
          cookies: parsedCookies,
          status: "active",
          updatedAt: new Date(),
        })
        .where(eq(teamsSyncConfigs.id, existing.id));
    } else {
      await db.insert(teamsSyncConfigs).values({
        userId: saUser.id,
        cookies: parsedCookies,
        status: "active",
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error("Error setting cookies:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
