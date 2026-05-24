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

export async function POST(req: NextRequest) {
  try {
    const saUser = await requireSpecialAdmin();
    const { channelUrl } = await req.json();

    if (!channelUrl) {
      return NextResponse.json({ error: "Missing channelUrl field" }, { status: 400 });
    }

    const syncConfig = await db.query.teamsSyncConfigs.findFirst({
      where: eq(teamsSyncConfigs.userId, saUser.id),
    });

    if (!syncConfig || !syncConfig.cookies) {
      return NextResponse.json(
        { error: "Session cookies not configured. Please paste your cookies first." },
        { status: 400 }
      );
    }

    let channel = await db.query.teamsChannels.findFirst({
      where: and(
        eq(teamsChannels.configId, syncConfig.id),
        eq(teamsChannels.teamsChannelId, channelUrl)
      ),
    });

    if (!channel) {
      const defaultName = channelUrl.split("/").pop() || "Synced Teams Channel";
      const [newChan] = await db
        .insert(teamsChannels)
        .values({
          configId: syncConfig.id,
          teamsChannelId: channelUrl,
          channelName: defaultName.substring(0, 50),
          teamName: "Microsoft Teams",
          isSynced: true,
        })
        .returning();
      channel = newChan;
    }

    console.log(`Publishing scrape_teams job for SA ${saUser.id} on channel ${channelUrl}`);
    const qstashResult = await publishJob("scrape_teams", {
      userId: saUser.id,
      channelUrl,
    });

    return NextResponse.json({
      ok: true,
      message: "Sync job successfully queued in background",
      messageId: qstashResult.messageId,
      channelId: channel.id,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    console.error("Error triggering sync:", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
