import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  isOfflineMode,
  buildOfflineSessionSetCookie,
  buildOfflineSessionClearCookie,
  OFFLINE_GUEST_USER,
} from "@/lib/auth/offline-session";

export const GUEST_EMAIL = OFFLINE_GUEST_USER.email;
export const GUEST_PASSWORD = "guest-local-dev";
export const GUEST_NAME = OFFLINE_GUEST_USER.name;

export function isGuestLoginEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ENABLE_LOGIN_SKIP === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_LOGIN_SKIP === "true" ||
    isOfflineMode()
  );
}

async function deleteGuestUser(): Promise<void> {
  await db.delete(users).where(eq(users.email, GUEST_EMAIL));
}

async function signInGuest(reqHeaders: Headers): Promise<Response> {
  return auth.api.signInEmail({
    body: {
      email: GUEST_EMAIL,
      password: GUEST_PASSWORD,
      rememberMe: true,
    },
    headers: reqHeaders,
    asResponse: true,
  });
}

async function signUpGuest(reqHeaders: Headers): Promise<Response> {
  return auth.api.signUpEmail({
    body: {
      email: GUEST_EMAIL,
      password: GUEST_PASSWORD,
      name: GUEST_NAME,
      rememberMe: true,
    },
    headers: reqHeaders,
    asResponse: true,
  });
}

async function ensureOnlineGuestLogin(): Promise<Response> {
  const reqHeaders = await headers();

  let response = await signInGuest(reqHeaders);
  if (response.ok) return response;

  response = await signUpGuest(reqHeaders);
  if (response.ok) return response;

  await deleteGuestUser();

  response = await signUpGuest(reqHeaders);
  if (response.ok) return response;

  let detail = "Could not start a guest session.";
  try {
    const body = (await response.json()) as { message?: string; error?: string };
    detail = body.message ?? body.error ?? detail;
  } catch {
    // ignore parse errors
  }

  return Response.json({ error: detail }, { status: response.status || 500 });
}

export async function ensureGuestLogin(): Promise<Response> {
  if (isOfflineMode()) {
    return createOfflineGuestResponse();
  }

  try {
    const response = await ensureOnlineGuestLogin();
    if (response.ok) return response;

    // DB reachable but guest auth failed — fall back to offline cookie so dev isn't blocked
    console.warn("[guest-skip] Online guest login failed, using offline session fallback");
    return createOfflineGuestResponse();
  } catch (err) {
    console.warn("[guest-skip] Online guest login error, using offline session fallback:", err);
    return createOfflineGuestResponse();
  }
}

async function createOfflineGuestResponse(): Promise<Response> {
  const setCookie = await buildOfflineSessionSetCookie();
  return Response.json(
    {
      ok: true,
      offline: true,
      user: OFFLINE_GUEST_USER,
    },
    {
      headers: {
        "Set-Cookie": setCookie,
      },
    }
  );
}

export async function clearGuestLogin(): Promise<Response> {
  const clearCookie = await buildOfflineSessionClearCookie();
  return Response.json(
    { ok: true },
    {
      headers: {
        "Set-Cookie": clearCookie,
      },
    }
  );
}
