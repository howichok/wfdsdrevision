"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Monitor, Search, LogOut, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/db/schema";

const ROLE_LABELS: Record<UserRole, string> = {
  SA: "Special Admin",
  T: "Teacher",
  S: "Substitute",
  SU: "Student",
};

interface SessionRow {
  id: string;
  userId: string;
  userEmail?: string;
  userName?: string | null;
  userRole?: string;
  deviceLabel: string;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  isCurrent: boolean;
}

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export function AdminSessionsClient() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [filter, setFilter] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async (userId?: string | null) => {
    setLoading(true);
    try {
      const url = userId ? `/api/admin/sessions?userId=${userId}` : "/api/admin/sessions";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      setSessions(data.sessions ?? []);
      if (data.users) setUsers(data.users);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(selectedUserId);
  }, [load, selectedUserId]);

  const revokeSession = async (sessionId: string) => {
    setActing(sessionId);
    try {
      const res = await fetch(`/api/admin/sessions?sessionId=${sessionId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success("Session revoked");
      await load(selectedUserId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActing(null);
    }
  };

  const revokeAllForUser = async (userId: string) => {
    setActing(`user-${userId}`);
    try {
      const res = await fetch(`/api/admin/sessions?userId=${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast.success(`Revoked all sessions for user`);
      await load(selectedUserId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActing(null);
    }
  };

  const filtered = sessions.filter((s) => {
    const q = filter.toLowerCase();
    if (!q) return true;
    return (
      s.userEmail?.toLowerCase().includes(q) ||
      s.userName?.toLowerCase().includes(q) ||
      s.deviceLabel.toLowerCase().includes(q) ||
      s.ipAddress?.includes(q)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading platform sessions...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex gap-3 text-sm text-amber-900">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <p>
          As Special Admin you can view and revoke any user session or sign a user out everywhere.
          Use this when accounts are compromised or devices should no longer have access.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by email, name, device, IP..."
            className="w-full rounded-lg border border-border pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={selectedUserId ?? ""}
          onChange={(e) => setSelectedUserId(e.target.value || null)}
          className="rounded-lg border border-border px-3 py-2 text-sm min-w-[200px]"
        >
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.email} ({ROLE_LABELS[u.role as UserRole] ?? u.role})
            </option>
          ))}
        </select>
      </div>

      {selectedUserId && (
        <button
          type="button"
          onClick={() => revokeAllForUser(selectedUserId)}
          disabled={acting === `user-${selectedUserId}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out this user everywhere
        </button>
      )}

      <div className="rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Device</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3">Last active</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No active sessions match your filters.
                </td>
              </tr>
            ) : (
              filtered.map((session) => (
                <tr key={session.id} className={cn(session.isCurrent && "bg-blue-50/40")}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{session.userName ?? session.userEmail}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.userEmail} · {ROLE_LABELS[session.userRole as UserRole] ?? session.userRole}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Monitor className="h-4 w-4 text-muted-foreground" />
                      {session.deviceLabel}
                      {session.isCurrent && (
                        <span className="text-[10px] font-bold text-blue-600">YOU</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{session.ipAddress ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(session.lastActiveAt ?? session.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => revokeSession(session.id)}
                      disabled={acting === session.id || session.isCurrent}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-40"
                    >
                      {acting === session.id ? "Revoking..." : "Revoke"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
