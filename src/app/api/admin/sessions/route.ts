import { type NextRequest, NextResponse } from "next/server";
import {
  listAllActiveSessions,
  listSessionsForUser,
  listDevicesForUser,
  revokeSessionById,
  revokeAllSessionsForUser,
  revokeDevice,
} from "@/lib/auth/session-manager";
import {
  requireSpecialAdmin,
  AuthError,
  authErrorResponse,
} from "@/lib/auth/permissions";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    await requireSpecialAdmin();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (userId) {
      const [sessions, devices] = await Promise.all([
        listSessionsForUser(userId),
        listDevicesForUser(userId),
      ]);
      return NextResponse.json({ sessions, devices });
    }

    const sessions = await listAllActiveSessions();
    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      columns: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    return NextResponse.json({ sessions, users: allUsers });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireSpecialAdmin();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const userId = searchParams.get("userId");
    const deviceId = searchParams.get("deviceId");

    if (userId) {
      const count = await revokeAllSessionsForUser(userId, { asAdmin: true });
      return NextResponse.json({ ok: true, revoked: count });
    }

    if (deviceId) {
      await revokeDevice(deviceId, { asAdmin: true });
      return NextResponse.json({ ok: true });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "sessionId, userId, or deviceId required" },
        { status: 400 }
      );
    }

    await revokeSessionById(sessionId, { asAdmin: true });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
