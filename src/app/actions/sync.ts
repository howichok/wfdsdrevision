"use server";

import { db } from "@/lib/db";
import { lessons, lessonChallengeSubmissions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";

export async function syncOfflineDataAction(
  userId: string,
  data: {
    drafts: {
      id: string;
      title: string;
      content: string;
      structuredContent: any;
      status: string;
      updatedAt: number;
    }[];
    submissions: {
      id: string;
      challengeId: string;
      userCode: string;
      status: "passed" | "failed";
      updatedAt: number;
    }[];
  }
) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session || session.user.id !== userId) {
      return { success: false, error: "Unauthorized session or mismatched user ID." };
    }

    // Process drafts
    for (const draft of data.drafts) {
      const existing = await db.query.lessons.findFirst({
        where: eq(lessons.id, draft.id),
      });

      if (existing) {
        if (existing.userId && existing.userId !== userId) {
          console.warn(`[Sync Server Action] Security violation: User ${userId} tried to modify lesson ${draft.id} owned by ${existing.userId}`);
          continue;
        }

        await db
          .update(lessons)
          .set({
            title: draft.title,
            content: draft.content,
            structuredContent: draft.structuredContent,
            status: draft.status,
            updatedAt: new Date(draft.updatedAt),
            userId,
          })
          .where(eq(lessons.id, draft.id));
      } else {
        await db.insert(lessons).values({
          id: draft.id,
          title: draft.title,
          content: draft.content,
          structuredContent: draft.structuredContent,
          status: draft.status,
          createdAt: new Date(draft.updatedAt),
          updatedAt: new Date(draft.updatedAt),
          userId,
        });
      }
    }

    // Process submissions
    for (const sub of data.submissions) {
      const existing = await db.query.lessonChallengeSubmissions.findFirst({
        where: and(
          eq(lessonChallengeSubmissions.challengeId, sub.challengeId),
          eq(lessonChallengeSubmissions.userId, userId)
        ),
      });

      if (existing) {
        await db
          .update(lessonChallengeSubmissions)
          .set({
            userCode: sub.userCode,
            status: sub.status,
            updatedAt: new Date(sub.updatedAt),
          })
          .where(eq(lessonChallengeSubmissions.id, existing.id));
      } else {
        await db.insert(lessonChallengeSubmissions).values({
          id: sub.id,
          challengeId: sub.challengeId,
          userId,
          userCode: sub.userCode,
          status: sub.status,
          createdAt: new Date(sub.updatedAt),
          updatedAt: new Date(sub.updatedAt),
        });
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error("[Sync Server Action] Failed to sync offline data:", err);
    return { success: false, error: err.message || "Failed to synchronize data." };
  }
}
