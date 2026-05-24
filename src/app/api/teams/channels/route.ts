import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { teamsSyncConfigs, teamsChannels } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireSpecialAdmin,
  AuthError,
  authErrorResponse,
} from "@/lib/auth/permissions";
import { publishJob } from "@/server/queues/qstash";

export async function GET() {
  try {
    const saUser = await requireSpecialAdmin();
    const syncConfig = await db.query.teamsSyncConfigs.findFirst({
      where: eq(teamsSyncConfigs.userId, saUser.id),
    });

    if (!syncConfig) {
      return NextResponse.json({ channels: [] });
    }

    const channels = await db.query.teamsChannels.findMany({
      where: eq(teamsChannels.configId, syncConfig.id),
    });

    return NextResponse.json({ channels });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const saUser = await requireSpecialAdmin();
    const { channelUrl, channelName, teamName } = await req.json();

    if (!channelUrl) {
      return NextResponse.json({ error: "Missing channelUrl" }, { status: 400 });
    }

    const syncConfig = await db.query.teamsSyncConfigs.findFirst({
      where: eq(teamsSyncConfigs.userId, saUser.id),
    });

    if (!syncConfig) {
      return NextResponse.json(
        { error: "Save Teams cookies before adding channels." },
        { status: 400 }
      );
    }

    const existing = await db.query.teamsChannels.findFirst({
      where: and(
        eq(teamsChannels.configId, syncConfig.id),
        eq(teamsChannels.teamsChannelId, channelUrl)
      ),
    });

    if (existing) {
      return NextResponse.json({ ok: true, channel: existing });
    }

    const defaultName = channelName || channelUrl.split("/").pop() || "Teams Channel";
    const [channel] = await db
      .insert(teamsChannels)
      .values({
        configId: syncConfig.id,
        teamsChannelId: channelUrl,
        channelName: defaultName.substring(0, 100),
        teamName: teamName || "Microsoft Teams",
        isSynced: true,
      })
      .returning();

    return NextResponse.json({ ok: true, channel });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Sync all registered channels for the SA */
export async function PUT() {
  try {
    const saUser = await requireSpecialAdmin();
    const syncConfig = await db.query.teamsSyncConfigs.findFirst({
      where: eq(teamsSyncConfigs.userId, saUser.id),
    });

    if (!syncConfig?.cookies) {
      return NextResponse.json({ error: "Teams cookies not configured" }, { status: 400 });
    }

    const channels = await db.query.teamsChannels.findMany({
      where: eq(teamsChannels.configId, syncConfig.id),
    });

    const active = channels.filter((c) => c.isSynced);
    const results = await Promise.all(
      active.map((c) =>
        publishJob("scrape_teams", {
          userId: saUser.id,
          channelUrl: c.teamsChannelId,
        })
      )
    );

    return NextResponse.json({
      ok: true,
      queued: active.length,
      messageIds: results.map((r) => r.messageId),
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
