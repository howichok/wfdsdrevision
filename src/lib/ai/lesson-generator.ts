import { db } from "@/lib/db";
import { lessons, sourceDocuments } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { Client } from "@upstash/qstash";
import {
  markdownToPlainText,
  parseMarkdownFrontmatter,
} from "@/lib/scraping/markdown-builder";

const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN || "",
});

export interface EnqueueLessonGenerationInput {
  sourceDocumentId?: string;
  rawContext?: string;
  userId?: string;
  subject?: string;
  teacherName?: string;
  title?: string;
}

async function publishRecallPipeline(lessonId: string, sourceDocumentId?: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const targetUrl = `${appUrl}/api/jobs/recall-pipeline`;
  const isDev = process.env.NODE_ENV === "development" || !process.env.QSTASH_TOKEN;
  const delay = isDev ? 2 : 5;

  const body = { lessonId, sourceDocumentId };

  if (process.env.QSTASH_TOKEN) {
    const result = await qstashClient.publishJSON({
      url: targetUrl,
      body,
      delay,
      retries: 3,
    });
    return result.messageId;
  }

  setTimeout(async () => {
    try {
      await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("Local recall pipeline trigger failed:", err);
    }
  }, delay * 1000);

  return "local-dev-trigger";
}

export async function enqueueLessonGeneration(
  input: EnqueueLessonGenerationInput
): Promise<{ lessonId: string; messageId: string }> {
  let rawContext = input.rawContext ?? "";
  let title = input.title ?? "Generating New Lesson...";
  let teacherName = input.teacherName ?? "AI Curriculum Bot";
  let subject = input.subject ?? "Computer Science";
  let sourceDocumentId = input.sourceDocumentId;

  if (sourceDocumentId) {
    const doc = await db.query.sourceDocuments.findFirst({
      where: eq(sourceDocuments.id, sourceDocumentId),
    });
    if (!doc) {
      throw new Error(`Source document ${sourceDocumentId} not found`);
    }
    if (doc.lessonId) {
      return { lessonId: doc.lessonId, messageId: "already-processed" };
    }
    rawContext = doc.markdown;
    const meta = parseMarkdownFrontmatter(doc.markdown);
    if (meta.sender) teacherName = meta.sender;
    title = `Lesson: ${meta.channel ?? doc.sender}`;
  }

  if (!rawContext.trim()) {
    throw new Error("No raw context available for lesson generation");
  }

  const plainPreview = markdownToPlainText(rawContext).slice(0, 500);

  const [newLesson] = await db
    .insert(lessons)
    .values({
      title,
      content: plainPreview || "AI is generating lesson content...",
      subject,
      teacherName,
      rawContext,
      status: "processing",
      userId: input.userId ?? null,
      date: new Date(),
    })
    .returning();

  if (sourceDocumentId) {
    await db
      .update(sourceDocuments)
      .set({ lessonId: newLesson.id, updatedAt: new Date() })
      .where(eq(sourceDocuments.id, sourceDocumentId));
  }

  const messageId = await publishRecallPipeline(newLesson.id, sourceDocumentId);
  return { lessonId: newLesson.id, messageId };
}

export async function processUnprocessedSourceDocuments(userId?: string) {
  const unprocessed = await db
    .select()
    .from(sourceDocuments)
    .where(and(eq(sourceDocuments.isProcessed, false), isNull(sourceDocuments.lessonId)));

  const results: { sourceDocumentId: string; lessonId: string }[] = [];

  for (const doc of unprocessed) {
    const { lessonId } = await enqueueLessonGeneration({
      sourceDocumentId: doc.id,
      userId,
    });
    results.push({ sourceDocumentId: doc.id, lessonId });
  }

  return results;
}
