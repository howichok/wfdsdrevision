import { type NextRequest, NextResponse } from "next/server";
import {
  registerCurrentSessionDevice,
  listSessionsForUser,
  listDevicesForUser,
  revokeSessionById,
  revokeAllSessionsForUser,
  revokeDevice,
  setDeviceTrusted,
} from "@/lib/auth/session-manager";
import {
  requireAuth,
  AuthError,
  authErrorResponse,
} from "@/lib/auth/permissions";

export async function GET() {
  try {
    const user = await requireAuth();
    const [sessions, devices] = await Promise.all([
      listSessionsForUser(user.id),
      listDevicesForUser(user.id),
    ]);
    return NextResponse.json({ sessions, devices });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    await registerCurrentSessionDevice();
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");
    const deviceId = searchParams.get("deviceId");
    const revokeOthers = searchParams.get("others") === "true";

    if (revokeOthers) {
      const count = await revokeAllSessionsForUser(user.id, { exceptCurrent: true });
      return NextResponse.json({ ok: true, revoked: count });
    }

    if (deviceId) {
      await revokeDevice(deviceId, { userId: user.id });
      return NextResponse.json({ ok: true });
    }

    if (!sessionId) {
      return NextResponse.json({ error: "sessionId or deviceId required" }, { status: 400 });
    }

    await revokeSessionById(sessionId, { allowUserId: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { deviceId, trusted } = await req.json();
    if (!deviceId || typeof trusted !== "boolean") {
      return NextResponse.json({ error: "deviceId and trusted required" }, { status: 400 });
    }
    await setDeviceTrusted(deviceId, trusted, user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
