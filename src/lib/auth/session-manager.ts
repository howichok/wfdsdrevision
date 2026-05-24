import { db } from "@/lib/db";
import { sessions, userDevices, users } from "@/lib/db/schema";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import {
  buildDeviceFingerprint,
  parseUserAgent,
} from "@/lib/auth/device-parser";

export interface SessionView {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string | null;
  userRole?: string;
  deviceLabel: string;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastActiveAt: Date | null;
  expiresAt: Date;
  isCurrent: boolean;
  userDeviceId: string | null;
  impersonatedBy: string | null;
}

export interface DeviceView {
  id: string;
  userId: string;
  deviceLabel: string;
  browser: string | null;
  os: string | null;
  lastIpAddress: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  isTrusted: boolean;
  revokedAt: Date | null;
  activeSessionCount: number;
}

async function getCurrentSessionToken(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.session?.token ?? null;
}

export async function registerCurrentSessionDevice(): Promise<void> {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });
  if (!session?.session?.id || !session.user?.id) return;

  const userAgent = reqHeaders.get("user-agent");
  const ipAddress =
    reqHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    reqHeaders.get("x-real-ip") ??
    session.session.ipAddress ??
    null;

  const parsed = parseUserAgent(userAgent);
  const fingerprint = buildDeviceFingerprint(userAgent, ipAddress);
  const now = new Date();

  let device = await db.query.userDevices.findFirst({
    where: and(
      eq(userDevices.userId, session.user.id),
      eq(userDevices.fingerprint, fingerprint),
      isNull(userDevices.revokedAt)
    ),
  });

  if (!device) {
    const [created] = await db
      .insert(userDevices)
      .values({
        userId: session.user.id,
        fingerprint,
        deviceLabel: parsed.deviceLabel,
        browser: parsed.browser,
        os: parsed.os,
        lastIpAddress: ipAddress,
        firstSeenAt: now,
        lastSeenAt: now,
      })
      .returning();
    device = created;
  } else {
    await db
      .update(userDevices)
      .set({
        lastSeenAt: now,
        lastIpAddress: ipAddress ?? device.lastIpAddress,
        deviceLabel: parsed.deviceLabel,
        browser: parsed.browser,
        os: parsed.os,
        updatedAt: now,
      })
      .where(eq(userDevices.id, device.id));
  }

  await db
    .update(sessions)
    .set({
      deviceLabel: parsed.deviceLabel,
      deviceFingerprint: fingerprint,
      userDeviceId: device.id,
      lastActiveAt: now,
      ipAddress: ipAddress ?? session.session.ipAddress,
      userAgent: userAgent ?? session.session.userAgent,
      updatedAt: now,
    })
    .where(eq(sessions.id, session.session.id));
}

function toSessionView(
  row: typeof sessions.$inferSelect & {
    userEmail?: string;
    userName?: string | null;
    userRole?: string;
  },
  currentToken: string | null
): SessionView {
  const parsed = parseUserAgent(row.userAgent);
  return {
    id: row.id,
    userId: row.userId,
    userEmail: row.userEmail,
    userName: row.userName,
    userRole: row.userRole,
    deviceLabel: row.deviceLabel ?? parsed.deviceLabel,
    browser: parsed.browser,
    os: parsed.os,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt,
    lastActiveAt: row.lastActiveAt ?? row.updatedAt,
    expiresAt: row.expiresAt,
    isCurrent: currentToken ? row.token === currentToken : false,
    userDeviceId: row.userDeviceId,
    impersonatedBy: row.impersonatedBy,
  };
}

export async function listSessionsForUser(userId: string): Promise<SessionView[]> {
  const currentToken = await getCurrentSessionToken();
  const now = new Date();

  const rows = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
    .orderBy(desc(sessions.lastActiveAt), desc(sessions.updatedAt));

  return rows.map((row) => toSessionView(row, currentToken));
}

export async function listAllActiveSessions(): Promise<SessionView[]> {
  const currentToken = await getCurrentSessionToken();
  const now = new Date();

  const rows = await db
    .select({
      session: sessions,
      userEmail: users.email,
      userName: users.name,
      userRole: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(gt(sessions.expiresAt, now))
    .orderBy(desc(sessions.lastActiveAt), desc(sessions.updatedAt));

  return rows.map(({ session, userEmail, userName, userRole }) =>
    toSessionView({ ...session, userEmail, userName, userRole }, currentToken)
  );
}

export async function listDevicesForUser(userId: string): Promise<DeviceView[]> {
  const now = new Date();
  const devices = await db.query.userDevices.findMany({
    where: and(eq(userDevices.userId, userId), isNull(userDevices.revokedAt)),
    orderBy: [desc(userDevices.lastSeenAt)],
  });

  const activeSessions = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)));

  return devices.map((device) => ({
    id: device.id,
    userId: device.userId,
    deviceLabel: device.deviceLabel,
    browser: device.browser,
    os: device.os,
    lastIpAddress: device.lastIpAddress,
    firstSeenAt: device.firstSeenAt,
    lastSeenAt: device.lastSeenAt,
    isTrusted: device.isTrusted,
    revokedAt: device.revokedAt,
    activeSessionCount: activeSessions.filter((s) => s.userDeviceId === device.id).length,
  }));
}

export async function revokeSessionById(
  sessionId: string,
  options?: { allowUserId?: string; asAdmin?: boolean }
): Promise<void> {
  const row = await db.query.sessions.findFirst({
    where: eq(sessions.id, sessionId),
  });
  if (!row) throw new Error("Session not found");

  const reqHeaders = await headers();

  if (options?.asAdmin) {
    await auth.api.revokeUserSession({
      body: { sessionToken: row.token },
      headers: reqHeaders,
    });
    return;
  }

  if (options?.allowUserId && row.userId !== options.allowUserId) {
    throw new Error("Cannot revoke another user's session");
  }

  await auth.api.revokeSession({
    body: { token: row.token },
    headers: reqHeaders,
  });
}

export async function revokeAllSessionsForUser(
  userId: string,
  options?: { exceptCurrent?: boolean; asAdmin?: boolean }
): Promise<number> {
  const reqHeaders = await headers();

  if (options?.asAdmin) {
    await auth.api.revokeUserSessions({
      body: { userId },
      headers: reqHeaders,
    });
    const rows = await db.query.sessions.findMany({ where: eq(sessions.userId, userId) });
    return rows.length;
  }

  if (options?.exceptCurrent) {
    await auth.api.revokeOtherSessions({ headers: reqHeaders });
    const currentToken = await getCurrentSessionToken();
    const rows = await db.query.sessions.findMany({ where: eq(sessions.userId, userId) });
    return rows.filter((r) => r.token !== currentToken).length;
  }

  await auth.api.revokeSessions({ headers: reqHeaders });
  const rows = await db.query.sessions.findMany({ where: eq(sessions.userId, userId) });
  return rows.length;
}

export async function revokeDevice(
  deviceId: string,
  options?: { userId?: string; asAdmin?: boolean }
): Promise<void> {
  const device = await db.query.userDevices.findFirst({
    where: eq(userDevices.id, deviceId),
  });
  if (!device) throw new Error("Device not found");
  if (options?.userId && device.userId !== options.userId) {
    throw new Error("Cannot revoke another user's device");
  }

  await db
    .update(userDevices)
    .set({ revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(userDevices.id, deviceId));

  const deviceSessions = await db.query.sessions.findMany({
    where: eq(sessions.userDeviceId, deviceId),
  });

  const reqHeaders = await headers();
  for (const row of deviceSessions) {
    if (options?.asAdmin) {
      await auth.api.revokeUserSession({
        body: { sessionToken: row.token },
        headers: reqHeaders,
      });
    } else {
      await auth.api.revokeSession({
        body: { token: row.token },
        headers: reqHeaders,
      });
    }
  }
}

export async function setDeviceTrusted(
  deviceId: string,
  trusted: boolean,
  userId?: string
): Promise<void> {
  const device = await db.query.userDevices.findFirst({
    where: eq(userDevices.id, deviceId),
  });
  if (!device) throw new Error("Device not found");
  if (userId && device.userId !== userId) {
    throw new Error("Cannot modify another user's device");
  }

  await db
    .update(userDevices)
    .set({ isTrusted: trusted, updatedAt: new Date() })
    .where(eq(userDevices.id, deviceId));
}
