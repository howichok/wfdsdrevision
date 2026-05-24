import { headers } from "next/headers";
import { auth } from "@/lib/auth/auth";
import { getOfflineSessionUser } from "@/lib/auth/offline-session-server";
import { db } from "@/lib/db";
import { users, type UserRole } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { isOfflineMode } from "@/lib/auth/offline-session";

export type { UserRole };

export const ROLE_LABELS: Record<UserRole, string> = {
  SA: "Special Admin",
  T: "Teacher",
  S: "Substitute",
  SU: "Student",
};

export async function getSessionUser() {
  const offlineUser = await getOfflineSessionUser();
  if (offlineUser) return offlineUser;

  if (isOfflineMode()) return null;

  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) return null;
  const role = ((session.user as { role?: string }).role ?? "SU") as UserRole;
  return { ...session.user, role };
}

export async function requireAuth() {
  const user = await getSessionUser();
  if (!user) {
    throw new AuthError("Authentication required", 401);
  }
  return user;
}

export async function requireRole(allowed: UserRole[]) {
  const user = await requireAuth();
  if (!allowed.includes(user.role)) {
    throw new AuthError("Insufficient permissions", 403);
  }
  return user;
}

export async function getSpecialAdmin() {
  if (isOfflineMode()) return null;
  return db.query.users.findFirst({
    where: eq(users.role, "SA"),
  });
}

export async function requireSpecialAdmin() {
  const user = await requireRole(["SA"]);
  const sa = await getSpecialAdmin();
  if (!sa || sa.id !== user.id) {
    throw new AuthError("Only the designated Special Admin may perform this action", 403);
  }
  return user;
}

export function canManageLessons(role: UserRole) {
  return role === "SA" || role === "T";
}

export function canPublishLessons(role: UserRole) {
  return role === "SA" || role === "T";
}

export function canViewProgress(role: UserRole) {
  return role === "SA" || role === "T" || role === "S";
}

export function canSyncTeams(role: UserRole) {
  return role === "SA";
}

export function canViewTeamsSync(role: UserRole) {
  return role === "SA" || role === "T";
}

export function canCreateLessons(role: UserRole) {
  return role === "SA" || role === "T";
}

export function canManageSessions(role: UserRole) {
  return role === "SA";
}

export function canViewOwnSessions(_role: UserRole) {
  return true;
}

export function lessonVisibilityFilter(role: UserRole): "all" | "published_only" {
  return role === "SU" || role === "S" ? "published_only" : "all";
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function authErrorResponse(err: unknown) {
  if (err instanceof AuthError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
