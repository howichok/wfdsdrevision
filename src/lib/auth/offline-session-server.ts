import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  OFFLINE_SESSION_COOKIE,
  OFFLINE_GUEST_USER,
  verifyOfflineSessionToken,
  type OfflineSessionUser,
} from "@/lib/auth/offline-session";

export async function getOfflineSessionUser(): Promise<OfflineSessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(OFFLINE_SESSION_COOKIE)?.value;
  return verifyOfflineSessionToken(token);
}

export async function getOfflineSessionFromRequest(
  request: NextRequest
): Promise<OfflineSessionUser | null> {
  const token = request.cookies.get(OFFLINE_SESSION_COOKIE)?.value;
  return verifyOfflineSessionToken(token);
}

export function hasOfflineSessionCookie(request: NextRequest): boolean {
  return Boolean(request.cookies.get(OFFLINE_SESSION_COOKIE)?.value);
}

export { OFFLINE_GUEST_USER };
