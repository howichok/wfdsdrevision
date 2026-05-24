import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { getOfflineSessionFromRequest } from "@/lib/auth/offline-session-server";

const PUBLIC_PATHS = ["/login", "/welcome"];
const SA_ONLY_API_PREFIXES = ["/api/teams/cookies", "/api/teams/sync", "/api/teams/channels"];
const PUBLIC_API_PATHS = ["/api/ai/kael"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/api/auth") ||
    PUBLIC_API_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/queue/webhook") ||
    pathname.startsWith("/api/jobs/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);
  const offlineUser = await getOfflineSessionFromRequest(request);
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!sessionCookie && !offlineUser && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/lessons/create" && (sessionCookie || offlineUser)) {
    return NextResponse.next();
  }

  if (SA_ONLY_API_PREFIXES.some((p) => pathname.startsWith(p)) && !sessionCookie && !offlineUser) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
