import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/permissions";
import { isOfflineMode } from "@/lib/auth/offline-session";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null, offline: isOfflineMode() });
  }
  return NextResponse.json({
    user,
    offline: isOfflineMode(),
  });
}
