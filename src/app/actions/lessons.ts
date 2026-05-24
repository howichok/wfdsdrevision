"use server";

import { db } from "@/lib/db";
import { lessons, lessonChallengeSubmissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  requireAuth,
  canManageLessons,
  canPublishLessons,
  AuthError,
} from "@/lib/auth/permissions";

export async function syncLessonAction(
  id: string,
  updates: {
    title?: string;
    content?: string;
    structuredContent?: unknown;
    status?: string;
  }
) {
  try {
    const user = await requireAuth();
    if (!canManageLessons(user.role)) {
      return { success: false, error: "Insufficient permissions to edit lessons." };
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.content !== undefined) updatePayload.content = updates.content;
    if (updates.structuredContent !== undefined)
      updatePayload.structuredContent = updates.structuredContent;
    if (updates.status !== undefined) updatePayload.status = updates.status;

    await db.update(lessons).set(updatePayload).where(eq(lessons.id, id));

    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Postgres sync failed";
    console.warn(`[Sync Action] Database sync failed for lesson ${id}:`, message);
    return {
      success: false,
      error: message,
    };
  }
}

export async function publishLessonAction(lessonId: string) {
  try {
    const user = await requireAuth();
    if (!canPublishLessons(user.role)) {
      return { success: false, error: "Only teachers and Special Admin can publish lessons." };
    }

    const lesson = await db.query.lessons.findFirst({
      where: eq(lessons.id, lessonId),
    });

    if (!lesson) {
      return { success: false, error: "Lesson not found." };
    }

    if (lesson.status !== "placeholder" && lesson.status !== "processing") {
      return { success: false, error: `Cannot publish lesson with status "${lesson.status}".` };
    }

    await db
      .update(lessons)
      .set({ status: "published", updatedAt: new Date() })
      .where(eq(lessons.id, lessonId));

    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to publish lesson";
    return { success: false, error: message };
  }
}

export async function submitChallengeAction(
  challengeId: string,
  userCode: string,
  status: "passed" | "failed"
) {
  try {
    const user = await requireAuth();
    const userId = user.id;

    const existing = await db.query.lessonChallengeSubmissions.findFirst({
      where: and(
        eq(lessonChallengeSubmissions.challengeId, challengeId),
        eq(lessonChallengeSubmissions.userId, userId)
      ),
    });

    if (existing) {
      await db
        .update(lessonChallengeSubmissions)
        .set({
          userCode,
          status,
          updatedAt: new Date(),
        })
        .where(eq(lessonChallengeSubmissions.id, existing.id));
    } else {
      await db.insert(lessonChallengeSubmissions).values({
        challengeId,
        userId,
        userCode,
        status,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return { success: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Database write failed.";
    return { success: false, error: message };
  }
}

export async function getLessonsHistoryAction(userId: string) {
  try {
    const user = await requireAuth();
    if (user.id !== userId) {
      return { success: false, error: "Unauthorized session or mismatched user ID." };
    }

    const userLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.userId, userId));

    return { success: true, lessons: userLessons };
  } catch (err) {
    if (err instanceof AuthError) {
      return { success: false, error: err.message };
    }
    const message = err instanceof Error ? err.message : "Failed to fetch lessons history.";
    return { success: false, error: message };
  }
}
