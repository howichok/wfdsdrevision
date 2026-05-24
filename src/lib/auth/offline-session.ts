import type { UserRole } from "@/lib/db/schema";

export const OFFLINE_SESSION_COOKIE = "offline-session";
export const OFFLINE_GUEST_ID = "00000000-0000-4000-8000-000000000001";

export interface OfflineSessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  image: string | null;
  emailVerified: boolean;
}

export const OFFLINE_GUEST_USER: OfflineSessionUser = {
  id: OFFLINE_GUEST_ID,
  email: "guest@local.dev",
  name: "Guest User",
  role: "SU",
  image: null,
  emailVerified: true,
};

/** True when the app should run without Postgres / cloud services. */
export function isOfflineMode(): boolean {
  return (
    process.env.OFFLINE_MODE === "true" ||
    process.env.NEXT_PUBLIC_OFFLINE_MODE === "true" ||
    !process.env.DATABASE_URL
  );
}

export function getOfflineAuthSecret(): string {
  return (
    process.env.BETTER_AUTH_SECRET ??
    process.env.OFFLINE_AUTH_SECRET ??
    "dev-offline-auth-secret-local-only"
  );
}

function encodePayload(user: OfflineSessionUser, exp: number): string {
  return `${user.id}|${exp}|${user.role}`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(sig));
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  return expected === signature;
}

export async function createOfflineSessionToken(
  user: OfflineSessionUser = OFFLINE_GUEST_USER,
  ttlSeconds = 60 * 60 * 24 * 30
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = encodePayload(user, exp);
  const signature = await hmacSign(payload, getOfflineAuthSecret());
  return `${payload}|${signature}`;
}

export async function verifyOfflineSessionToken(
  token: string | undefined | null
): Promise<OfflineSessionUser | null> {
  if (!token) return null;

  const parts = token.split("|");
  if (parts.length !== 4) return null;

  const [userId, expRaw, role, signature] = parts;
  const exp = Number(expRaw);
  if (!userId || !Number.isFinite(exp) || !role || !signature) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;

  const payload = `${userId}|${exp}|${role}`;
  const valid = await hmacVerify(payload, signature, getOfflineAuthSecret());
  if (!valid) return null;

  if (userId !== OFFLINE_GUEST_USER.id) return null;

  return { ...OFFLINE_GUEST_USER, role: role as UserRole };
}

export function offlineSessionCookieOptions(maxAgeSeconds = 60 * 60 * 24 * 30) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export async function buildOfflineSessionSetCookie(): Promise<string> {
  const token = await createOfflineSessionToken();
  const opts = offlineSessionCookieOptions();
  const parts = [
    `${OFFLINE_SESSION_COOKIE}=${token}`,
    "Path=/",
    `Max-Age=${opts.maxAge}`,
    "HttpOnly",
    `SameSite=${opts.sameSite}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export async function buildOfflineSessionClearCookie(): Promise<string> {
  return `${OFFLINE_SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=lax`;
}
