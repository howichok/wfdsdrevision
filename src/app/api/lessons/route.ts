import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { lessons } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  requireAuth,
  canCreateLessons,
  lessonVisibilityFilter,
  AuthError,
  authErrorResponse,
} from "@/lib/auth/permissions";
import { enqueueLessonGeneration } from "@/lib/ai/lesson-generator";

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 });
    }

    const lesson = await db.query.lessons.findFirst({
      where: eq(lessons.id, id),
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const visibility = lessonVisibilityFilter(user.role);
    if (visibility === "published_only" && lesson.status !== "published") {
      return NextResponse.json({ error: "Lesson not available" }, { status: 403 });
    }

    return NextResponse.json({ success: true, lesson });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!canCreateLessons(user.role)) {
      return NextResponse.json({ error: "Insufficient permissions to create lessons" }, { status: 403 });
    }

    const { title, content, subject, teacherName, attachments } = await req.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    const rawContext = `---
date: ${new Date().toISOString()}
channel: Manual Entry
team: Portal
sender: ${teacherName || user.name || "Teacher"}
---

${content.trim()}`;

    const { lessonId, messageId } = await enqueueLessonGeneration({
      rawContext,
      userId: user.id,
      subject: subject || "Computer Science",
      teacherName: teacherName || user.name || "Teacher",
      title: title.trim(),
    });

    const lesson = await db.query.lessons.findFirst({
      where: eq(lessons.id, lessonId),
    });

    if (attachments) {
      await db
        .update(lessons)
        .set({ attachments })
        .where(eq(lessons.id, lessonId));
    }

    return NextResponse.json({
      success: true,
      lesson: { ...lesson, attachments: attachments ?? null },
      messageId,
    });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
