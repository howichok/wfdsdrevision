import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lessonRecallNodes, userErrorMemory, lessons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: lessonRecallNodes.id,
        lessonId: lessonRecallNodes.lessonId,
        lessonTitle: lessons.title,
        nodeType: lessonRecallNodes.nodeType,
        key: lessonRecallNodes.key,
        summary: lessonRecallNodes.summary,
        metadata: lessonRecallNodes.metadata,
        masteryScore: userErrorMemory.masteryScore,
      })
      .from(lessonRecallNodes)
      .leftJoin(lessons, eq(lessonRecallNodes.lessonId, lessons.id))
      .leftJoin(userErrorMemory, eq(lessonRecallNodes.key, userErrorMemory.concept));

    return NextResponse.json({
      nodes: rows.map((r) => ({ ...r, masteryScore: r.masteryScore ?? 0 })),
    });
  } catch (err) {
    console.error("[graph/nodes]", err);
    return NextResponse.json({ nodes: [] });
  }
}
