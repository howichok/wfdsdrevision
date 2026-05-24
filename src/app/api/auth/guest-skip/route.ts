import { ensureGuestLogin, clearGuestLogin, isGuestLoginEnabled } from "@/lib/auth/guest-login";

export const runtime = "nodejs";

export async function POST() {
  if (!isGuestLoginEnabled()) {
    return Response.json({ error: "Guest login is disabled." }, { status: 403 });
  }

  return ensureGuestLogin();
}

export async function DELETE() {
  return clearGuestLogin();
}
