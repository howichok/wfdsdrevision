import { type NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  topics,
  questions,
  submissions,
  teamsSyncConfigs,
  teamsChannels,
  teamsMessages,
  sourceDocuments,
  documents,
  embeddings,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import {
  EmbedDocumentPayload,
  ScrapeUrlPayload,
  ScrapeTeamsPayload,
  MarkSubmissionPayload,
} from "@/server/queues/qstash";
import { scrapeTeamsChannel, downloadTeamsAttachment } from "@/lib/scraping/teams";
import { parseAttachmentServer } from "@/lib/scraping/parser-server";
import {
  buildSourceMarkdown,
  markdownToPlainText,
  type AttachmentSection,
} from "@/lib/scraping/markdown-builder";
import { generateQuestionsFromMaterial, gradeAttempt } from "@/lib/ai/marking";
import { enqueueLessonGeneration } from "@/lib/ai/lesson-generator";
import { embedBatch } from "@/lib/ai/gemini";

// Standard Node.js runtime is REQUIRED for Playwright browser execution
export const runtime = "nodejs";

const JobSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("embed_document"), payload: EmbedDocumentPayload }),
  z.object({ type: z.literal("scrape_url"), payload: ScrapeUrlPayload }),
  z.object({ type: z.literal("scrape_teams"), payload: ScrapeTeamsPayload }),
  z.object({ type: z.literal("mark_submission"), payload: MarkSubmissionPayload }),
]);

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const job = JobSchema.parse(body);

    console.log(`Processing background job: ${job.type}`);

    switch (job.type) {
      case "scrape_teams":
        await handleScrapeTeams(job.payload);
        break;

      case "mark_submission":
        await handleMarkSubmission(job.payload);
        break;

      case "embed_document":
        await handleEmbedDocument(job.payload);
        break;

      case "scrape_url":
        console.log("Scrape URL payload received:", job.payload);
        break;

      default:
        return NextResponse.json({ error: "Unknown job type" }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error executing background job webhook:", err);
    return NextResponse.json({ error: err.message || "Internal Error" }, { status: 500 });
  }
}

/**
 * Syncs messages and attachments from Microsoft Teams, generates questions via Gemini.
 */
async function handleScrapeTeams(payload: z.infer<typeof ScrapeTeamsPayload>) {
  const { userId, channelUrl } = payload;

  // 1. Fetch user's Teams sync cookies
  const syncConfig = await db.query.teamsSyncConfigs.findFirst({
    where: eq(teamsSyncConfigs.userId, userId),
  });

  if (!syncConfig || !syncConfig.cookies) {
    throw new Error(`Teams sync configuration not found or expired for user ${userId}`);
  }

  // 2. Perform Playwright channel scrape
  console.log(`Starting scraper for channel ${channelUrl}`);
  const scrapedMessages = await scrapeTeamsChannel({
    channelUrl,
    cookies: syncConfig.cookies,
    maxMessages: 10,
  });

  if (scrapedMessages.length === 0) {
    console.log("No messages found or failed to parse channel HTML.");
    return;
  }

  // 3. Resolve or create Teams channel entry in DB
  let channel = await db.query.teamsChannels.findFirst({
    where: and(
      eq(teamsChannels.configId, syncConfig.id),
      eq(teamsChannels.teamsChannelId, channelUrl) // Using channelUrl as the unique identifier
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

  // 4. Process each message
  for (const msg of scrapedMessages) {
    // Check if message was already scraped/processed
    const exists = await db.query.teamsMessages.findFirst({
      where: and(
        eq(teamsMessages.channelId, channel.id),
        eq(teamsMessages.teamsMessageId, msg.id)
      ),
    });

    if (exists) {
      console.log(`Message ${msg.id} already exists in DB. Skipping.`);
      continue;
    }

    console.log(`Processing new message: ${msg.id} from ${msg.sender}`);

    // Parse attachments into sections
    const attachmentSections: AttachmentSection[] = [];
    if (msg.attachments && msg.attachments.length > 0) {
      for (const att of msg.attachments) {
        try {
          console.log(`Downloading and parsing attachment: ${att.fileName}`);
          const fileBuffer = await downloadTeamsAttachment({
            fileUrl: att.url,
            cookies: syncConfig.cookies,
          });
          const text = await parseAttachmentServer(fileBuffer, att.fileName);
          attachmentSections.push({
            fileName: att.fileName,
            text,
            url: att.url,
            type: att.type,
          });
        } catch (fileErr) {
          console.error(`Failed to download/parse file ${att.fileName}:`, fileErr);
        }
      }
    }

    const postedAt = msg.timestamp ? new Date(msg.timestamp) : new Date();
    const markdown = buildSourceMarkdown(msg.content, attachmentSections, {
      postedAt,
      channel: channel.channelName,
      team: channel.teamName ?? "Microsoft Teams",
      sender: msg.sender,
      teamsMessageId: msg.id,
      syncedAt: new Date(),
    });
    const fullContent = markdownToPlainText(markdown);

    const [savedMsg] = await db
      .insert(teamsMessages)
      .values({
        channelId: channel.id,
        teamsMessageId: msg.id,
        sender: msg.sender,
        content: msg.content,
        attachments: msg.attachments,
        postedAt,
        isProcessed: false,
      })
      .returning();

    const [savedDoc] = await db
      .insert(sourceDocuments)
      .values({
        teamsMessageId: msg.id,
        channelId: channel.id,
        postedAt,
        sender: msg.sender,
        markdown,
        rawPlainText: fullContent,
        attachments: msg.attachments,
        isProcessed: false,
      })
      .returning();

    if (fullContent.trim().length > 50) {
      try {
        console.log(`Enqueuing AI lesson generation for message ${msg.id}...`);
        await enqueueLessonGeneration({
          sourceDocumentId: savedDoc.id,
          userId,
        });
      } catch (lessonErr) {
        console.error(`Failed to enqueue lesson for message ${msg.id}:`, lessonErr);
      }

      try {
        console.log(`Generating AI revision questions for message ${msg.id}...`);
        const generated = await generateQuestionsFromMaterial({
          materialText: fullContent,
          sourceContext: `Teams Post by ${msg.sender} in ${channel.channelName} on ${postedAt.toISOString()}`,
        });

        const [newTopic] = await db
          .insert(topics)
          .values({
            title: generated.topicTitle,
            description: generated.topicDescription,
          })
          .returning();

        for (const q of generated.questions) {
          await db.insert(questions).values({
            topicId: newTopic.id,
            title: q.title,
            text: q.text,
            type: q.type,
            gradingCriteria: q.gradingCriteria,
            sampleAnswer: q.sampleAnswer,
            difficulty: q.difficulty,
          });
        }

        await db
          .update(teamsMessages)
          .set({
            isProcessed: true,
            processedAt: new Date(),
          })
          .where(eq(teamsMessages.id, savedMsg.id));

        console.log(`Topic '${generated.topicTitle}' and ${generated.questions.length} questions created.`);
      } catch (aiErr) {
        console.error(`Failed to generate questions for message ${msg.id}:`, aiErr);
      }
    }
  }

  // Update last synced date
  await db
    .update(teamsSyncConfigs)
    .set({ lastSyncedAt: new Date() })
    .where(eq(teamsSyncConfigs.id, syncConfig.id));
}

/**
 * Grades user answer against question sample & criteria, updates submission.
 */
async function handleMarkSubmission(payload: z.infer<typeof MarkSubmissionPayload>) {
  const { submissionId } = payload;

  // 1. Fetch submission details along with the question it belongs to
  const submission = await db.query.submissions.findFirst({
    where: eq(submissions.id, submissionId),
  });

  if (!submission) {
    throw new Error(`Submission ${submissionId} not found in database`);
  }

  const question = await db.query.questions.findFirst({
    where: eq(questions.id, submission.questionId),
  });

  if (!question) {
    await db
      .update(submissions)
      .set({
        status: "failed",
        markedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId));
    throw new Error(`Question ${submission.questionId} not found for submission ${submissionId}`);
  }

  console.log(`Grading submission ${submissionId} for question: ${question.title}`);

  // 2. Perform AI evaluation
  const feedback = await gradeAttempt({
    questionText: question.text,
    gradingCriteria: question.gradingCriteria,
    sampleAnswer: question.sampleAnswer,
    userAnswer: submission.userAnswer,
  });

  // 3. Save feedback and scores to database
  await db
    .update(submissions)
    .set({
      score: feedback.score,
      feedback: feedback,
      status: "marked",
      markedAt: new Date(),
    })
    .where(eq(submissions.id, submissionId));

  console.log(`Submission ${submissionId} successfully marked. Score: ${feedback.score}%`);
}

function chunkText(text: string, chunkSize = 512): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks.filter((c) => c.trim().length > 0);
}

async function handleEmbedDocument(payload: z.infer<typeof EmbedDocumentPayload>) {
  const { documentId, chunkSize } = payload;
  const doc = await db.query.documents.findFirst({
    where: eq(documents.id, documentId),
  });
  if (!doc || !doc.content?.trim()) {
    throw new Error(`Document ${documentId} not found or empty`);
  }

  const chunks = chunkText(doc.content, chunkSize);
  const vectors = await embedBatch(chunks);

  for (let i = 0; i < chunks.length; i++) {
    await db.insert(embeddings).values({
      documentId,
      chunkIndex: i,
      chunkText: chunks[i],
      embedding: vectors[i],
      metadata: { source: "teams_ingest" },
    });
  }

  console.log(`Embedded ${chunks.length} chunks for document ${documentId}`);
}

// Support bypassing QStash signature verification in development or build contexts when keys are missing
export const POST =
  process.env.NODE_ENV === "development" || !process.env.QSTASH_CURRENT_SIGNING_KEY
    ? handler
    : verifySignatureAppRouter(handler);
