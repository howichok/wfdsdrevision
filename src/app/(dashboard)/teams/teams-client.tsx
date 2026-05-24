"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Key,
  Globe,
  RefreshCw,
  Check,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TeamsSyncClientProps {
  isSa: boolean;
  hasCookies: boolean;
  lastSyncDate: string;
  syncStatus: string;
  channels: {
    id: string;
    teamsChannelId: string;
    channelName: string;
    teamName?: string | null;
    isSynced: boolean;
  }[];
}

export function TeamsSyncClient({
  isSa,
  hasCookies: initialHasCookies,
  lastSyncDate: initialLastSyncDate,
  syncStatus,
  channels: initialChannels,
}: TeamsSyncClientProps) {
  const [hasCookies, setHasCookies] = useState(initialHasCookies);
  const [cookieInput, setCookieInput] = useState("");
  const [channelInput, setChannelInput] = useState("");
  const [isSavingCookies, setIsSavingCookies] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [channels, setChannels] = useState(initialChannels);

  const handleSaveCookies = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cookieInput.trim()) {
      toast.error("Please enter a JSON cookie array");
      return;
    }

    setIsSavingCookies(true);
    try {
      const res = await fetch("/api/teams/cookies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: cookieInput }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save cookies");

      toast.success("Microsoft Teams session cookies saved successfully!");
      setHasCookies(true);
      setCookieInput("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      toast.error(message);
    } finally {
      setIsSavingCookies(false);
    }
  };

  const handleTriggerSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelInput.trim()) {
      toast.error("Please enter a Microsoft Teams channel URL");
      return;
    }

    if (!hasCookies) {
      toast.error("Please save your session cookies first");
      return;
    }

    setIsSyncing(true);
    try {
      const res = await fetch("/api/teams/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelUrl: channelInput }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to trigger sync");

      toast.success("Sync job queued! AI will generate lessons from new posts.");
      const url = channelInput;
      setChannelInput("");

      const alreadyInList = channels.some((c) => c.teamsChannelId === url);
      if (!alreadyInList) {
        setChannels((prev) => [
          ...prev,
          {
            id: data.channelId || `temp-${Date.now()}`,
            teamsChannelId: url,
            channelName: url.split("/").pop() || "Synced Teams Channel",
            teamName: "Microsoft Teams",
            isSynced: true,
          },
        ]);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      toast.error(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncAll = async () => {
    if (!hasCookies || channels.length === 0) {
      toast.error("Add at least one channel before syncing all");
      return;
    }
    setIsSyncingAll(true);
    try {
      const res = await fetch("/api/teams/channels", { method: "PUT" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sync all channels");
      toast.success(`Queued sync for ${data.queued} channel(s)`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Sync all failed";
      toast.error(message);
    } finally {
      setIsSyncingAll(false);
    }
  };

  if (!isSa) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <p className="text-sm text-slate-600">
          Teams sync is managed by the Special Admin. You can view activity in the log on the right.
        </p>
        <div className="divide-y divide-slate-100 pt-2">
          {channels.length > 0 ? (
            channels.map((chan) => (
              <div key={chan.id} className="py-3 first:pt-0 flex items-center justify-between text-sm">
                <div>
                  <p className="font-bold text-slate-800">{chan.channelName}</p>
                  <p className="text-xs text-slate-500 truncate max-w-md mt-0.5">{chan.teamsChannelId}</p>
                </div>
                <span className="text-xs font-semibold text-emerald-700">Connected</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 py-4">No channels synced yet.</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded bg-blue-50 p-2 text-blue-600 border border-blue-200">
            <Key className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">1. Teams Session (SA only)</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Paste your Teams browser cookies. All portal data is retrieved from this account.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveCookies} className="space-y-4 pt-2">
          <textarea
            placeholder='[{"name": "ESTSAUTH", "value": "...", "domain": ".login.microsoftonline.com"}, ...]'
            value={cookieInput}
            onChange={(e) => setCookieInput(e.target.value)}
            className="w-full min-h-[120px] rounded border border-slate-200 bg-slate-50 p-3 text-xs font-mono focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
          />

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 text-xs">
              {hasCookies ? (
                <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  <Check className="h-3.5 w-3.5" /> Authentication Configured
                </span>
              ) : (
                <span className="flex items-center gap-1 font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                  <AlertTriangle className="h-3.5 w-3.5" /> Session Cookies Required
                </span>
              )}
            </div>
            <button
              type="submit"
              disabled={isSavingCookies}
              className="inline-flex h-8.5 items-center justify-center rounded bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSavingCookies ? "Saving..." : "Save Cookies"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded bg-blue-50 p-2 text-blue-600 border border-blue-200">
            <Globe className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">2. Sync Class Channel</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Add a channel URL. Each sync creates MD source documents and AI-generated lessons.
            </p>
          </div>
        </div>

        <form onSubmit={handleTriggerSync} className="space-y-4 pt-2">
          <input
            type="url"
            placeholder="https://teams.microsoft.com/l/channel/..."
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            required
            className="w-full rounded border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
          />

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[11px] text-slate-500">
              Status: <span className="font-semibold text-slate-700">{syncStatus}</span> | Last sync:{" "}
              <span className="font-semibold text-slate-700">{initialLastSyncDate}</span>
            </p>
            <button
              type="submit"
              disabled={isSyncing || !hasCookies}
              className="inline-flex h-8.5 items-center justify-center gap-1.5 rounded bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isSyncing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Start Sync
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded bg-blue-50 p-2 text-blue-600 border border-blue-200">
              <FolderOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Connected Classrooms</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Channels registered under your SA Teams account.
              </p>
            </div>
          </div>
          {channels.length > 0 && (
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={isSyncingAll || !hasCookies}
              className={cn(
                "inline-flex items-center gap-1.5 rounded border border-slate-200 px-3 py-1.5 text-xs font-semibold",
                "hover:bg-slate-50 disabled:opacity-50"
              )}
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isSyncingAll && "animate-spin")} />
              Sync All
            </button>
          )}
        </div>

        <div className="divide-y divide-slate-100 pt-2">
          {channels.length > 0 ? (
            channels.map((chan) => (
              <div key={chan.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between text-sm">
                <div>
                  <p className="font-bold text-slate-800">{chan.channelName}</p>
                  <p className="text-xs text-slate-500 truncate max-w-sm md:max-w-md mt-0.5">
                    {chan.teamsChannelId}
                  </p>
                </div>
                <span className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  Connected
                </span>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-xs text-slate-500">
              No synced classrooms yet. Paste auth cookies and start a channel sync.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
