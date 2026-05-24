"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { Monitor, Smartphone, Tablet, Loader2, Shield, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionRow {
  id: string;
  deviceLabel: string;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastActiveAt: string | null;
  expiresAt: string;
  isCurrent: boolean;
  userDeviceId: string | null;
}

interface DeviceRow {
  id: string;
  deviceLabel: string;
  browser: string | null;
  os: string | null;
  lastIpAddress: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  isTrusted: boolean;
  activeSessionCount: number;
}

function DeviceIcon({ label }: { label: string }) {
  const lower = label.toLowerCase();
  if (lower.includes("iphone") || lower.includes("android")) {
    return <Smartphone className="h-4 w-4" />;
  }
  if (lower.includes("ipad") || lower.includes("tablet")) {
    return <Tablet className="h-4 w-4" />;
  }
  return <Monitor className="h-4 w-4" />;
}

export function SecuritySessionsClient() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await fetch("/api/sessions", { method: "POST" });
      const res = await fetch("/api/sessions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load sessions");
      setSessions(data.sessions ?? []);
      setDevices(data.devices ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revokeSession = async (sessionId: string) => {
    setActing(sessionId);
    try {
      const res = await fetch(`/api/sessions?sessionId=${sessionId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke");
      toast.success("Session signed out");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke session");
    } finally {
      setActing(null);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    setActing(deviceId);
    try {
      const res = await fetch(`/api/sessions?deviceId=${deviceId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke device");
      toast.success("Device signed out everywhere");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke device");
    } finally {
      setActing(null);
    }
  };

  const revokeOthers = async () => {
    setActing("others");
    try {
      const res = await fetch("/api/sessions?others=true", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke");
      toast.success(`Signed out ${data.revoked ?? 0} other session(s)`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setActing(null);
    }
  };

  const toggleTrust = async (deviceId: string, trusted: boolean) => {
    setActing(`trust-${deviceId}`);
    try {
      const res = await fetch("/api/sessions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, trusted }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update device");
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading sessions...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-bold">Active Sessions</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Devices and browsers currently signed in to your account.
          </p>
        </div>
        {sessions.filter((s) => !s.isCurrent).length > 0 && (
          <button
            type="button"
            onClick={revokeOthers}
            disabled={acting === "others"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out other sessions
          </button>
        )}
      </div>

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active sessions found.</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-card p-4"
            >
              <div className="flex gap-3">
                <div className="mt-0.5 text-primary">
                  <DeviceIcon label={session.deviceLabel} />
                </div>
                <div>
                  <p className="text-sm font-semibold flex items-center gap-2">
                    {session.deviceLabel}
                    {session.isCurrent && (
                      <span className="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                        This device
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    IP {session.ipAddress ?? "unknown"} · Last active{" "}
                    {new Date(session.lastActiveAt ?? session.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              {!session.isCurrent && (
                <button
                  type="button"
                  onClick={() => revokeSession(session.id)}
                  disabled={acting === session.id}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {acting === session.id ? "Revoking..." : "Sign out"}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Registered Devices
        </h2>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Trusted devices stay recognized across sign-ins. Revoking removes all sessions on that device.
        </p>
        <div className="space-y-3">
          {devices.map((device) => (
            <div
              key={device.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-border/40 bg-card p-4"
            >
              <div>
                <p className="text-sm font-semibold">{device.deviceLabel}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {device.activeSessionCount} active session(s) · Last seen{" "}
                  {new Date(device.lastSeenAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleTrust(device.id, !device.isTrusted)}
                  disabled={acting === `trust-${device.id}`}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[10px] font-bold border",
                    device.isTrusted
                      ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                      : "bg-slate-50 border-slate-200 text-slate-600"
                  )}
                >
                  {device.isTrusted ? "Trusted" : "Trust"}
                </button>
                <button
                  type="button"
                  onClick={() => revokeDevice(device.id)}
                  disabled={acting === device.id}
                  className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Revoke
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
