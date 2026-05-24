import { db } from "@/lib/db";
import {
  teamsSyncConfigs,
  teamsChannels,
  teamsMessages,
  sourceDocuments,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser, getSpecialAdmin } from "@/lib/auth/permissions";
import { redirect } from "next/navigation";
import { TeamsSyncClient } from "./teams-client";

export const dynamic = "force-dynamic";

export default async function TeamsSyncPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const isSa = user.role === "SA";
  const sa = await getSpecialAdmin();
  const configUserId = sa?.id ?? user.id;

  let syncConfig = null;
  let channels: typeof teamsChannels.$inferSelect[] = [];
  let messages: typeof teamsMessages.$inferSelect[] = [];
  let documents: typeof sourceDocuments.$inferSelect[] = [];

  try {
    syncConfig =
      (await db.query.teamsSyncConfigs.findFirst({
        where: eq(teamsSyncConfigs.userId, configUserId),
      })) ?? null;

    if (syncConfig) {
      channels = await db.query.teamsChannels.findMany({
        where: eq(teamsChannels.configId, syncConfig.id),
      });
    }

    messages = await db.query.teamsMessages.findMany({
      orderBy: [desc(teamsMessages.postedAt), desc(teamsMessages.createdAt)],
      limit: 15,
    });

    documents = await db.query.sourceDocuments.findMany({
      orderBy: [desc(sourceDocuments.postedAt)],
      limit: 10,
    });
  } catch (err) {
    console.warn("Database connection issue in TeamsSyncPage:", err);
  }

  const hasCookies = !!syncConfig?.cookies;
  const lastSyncDate = syncConfig?.lastSyncedAt
    ? new Date(syncConfig.lastSyncedAt).toLocaleString()
    : "Never synced";

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">
          {isSa ? "Teams Synchronization" : "Teams Activity"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isSa
            ? "Configure your Teams account and sync class channels. All portal data is retrieved from this account."
            : "View synced class material imported by the Special Admin."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <TeamsSyncClient
            isSa={isSa}
            hasCookies={hasCookies}
            lastSyncDate={lastSyncDate}
            syncStatus={syncConfig?.status || "inactive"}
            channels={channels}
          />
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-4">
          <h2 className="font-heading text-lg font-bold">Sync Activity Log</h2>
          <p className="text-xs text-muted-foreground">
            Posts extracted from synced channels with Markdown source documents.
          </p>

          <div className="mt-4 space-y-4 overflow-y-auto max-h-[500px] pr-2">
            {messages.length > 0 ? (
              messages.map((msg) => {
                const doc = documents.find((d) => d.teamsMessageId === msg.teamsMessageId);
                const displayDate = msg.postedAt ?? msg.createdAt;
                return (
                  <div
                    key={msg.id}
                    className="rounded-xl border border-border/30 bg-accent/15 p-3 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>{msg.sender}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(displayDate).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground line-clamp-3">{msg.content}</p>
                    {doc && (
                      <span className="inline-flex items-center rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700">
                        MD document saved
                        {doc.lessonId ? " · lesson queued" : ""}
                      </span>
                    )}
                    {Array.isArray(msg.attachments) && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {(msg.attachments as { fileName: string }[]).map((att, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary"
                          >
                            📎 {att.fileName}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-muted-foreground">
                {isSa
                  ? "No sync activity yet. Paste cookies and start a channel sync."
                  : "No synced activity yet. The Special Admin has not synced Teams data."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
