import { NextRequest, NextResponse } from "next/server";
import { buildPathlineData, buildOfflinePathlineData } from "@/lib/revision/pathline-data";
import { parseRevisionScope } from "@/lib/revision/revision-scope";
import {
  requireAuth,
  AuthError,
  authErrorResponse,
} from "@/lib/auth/permissions";
import { isOfflineMode } from "@/lib/auth/offline-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const scope = parseRevisionScope(request.nextUrl.searchParams);

    if (isOfflineMode()) {
      return NextResponse.json(buildOfflinePathlineData());
    }

    try {
      const data = await buildPathlineData(user.id, user.role, scope);
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(buildOfflinePathlineData());
    }
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
