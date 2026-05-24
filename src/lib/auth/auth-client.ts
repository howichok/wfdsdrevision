import { createAuthClient } from "better-auth/react";
import { adminClient, multiSessionClient } from "better-auth/client/plugins";
import { useEffect, useState } from "react";
import type { UserRole } from "@/lib/db/schema";

function resolveAuthBaseURL(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

let client: ReturnType<typeof createAuthClient> | null = null;

function getAuthClient() {
  if (!client) {
    client = createAuthClient({
      baseURL: resolveAuthBaseURL(),
      plugins: [multiSessionClient(), adminClient()],
    });
  }
  return client;
}

export const authClient = new Proxy({} as ReturnType<typeof createAuthClient>, {
  get(_target, prop, receiver) {
    return Reflect.get(getAuthClient(), prop, receiver);
  },
});

export const {
  signIn,
  signUp,
  useSession,
  signOut,
  listSessions,
  revokeSession,
  revokeOtherSessions,
  revokeSessions,
} = authClient;

interface AppUser {
  id: string;
  email: string;
  name: string;
  role?: UserRole;
  image?: string | null;
}

/** Combines better-auth session with offline guest session from /api/auth/me. */
export function useAppSession() {
  const authSession = useSession();
  const [offlineUser, setOfflineUser] = useState<AppUser | null>(null);
  const [offlineChecked, setOfflineChecked] = useState(false);

  useEffect(() => {
    if (authSession.isPending || authSession.data?.user) return;

    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user?: AppUser | null }) => {
        if (data.user) setOfflineUser(data.user);
      })
      .catch(() => {})
      .finally(() => setOfflineChecked(true));
  }, [authSession.isPending, authSession.data?.user]);

  if (authSession.data?.user) return authSession;

  if (offlineUser) {
    return {
      ...authSession,
      data: { user: offlineUser, session: null },
      isPending: false,
    };
  }

  return {
    ...authSession,
    isPending: authSession.isPending || !offlineChecked,
  };
}
