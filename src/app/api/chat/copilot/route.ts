// Do NOT use Edge runtime because of node-postgres TCP socket requirements
export const runtime = "nodejs";

import { type NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { geminiFlash } from "@/lib/ai/gemini";
import { db } from "@/lib/db";
import { lessons, lessonRecallNodes, sourceDocuments, userErrorMemory } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

// Keep an in-memory cache of created Gemini context caches to avoid calling Google REST API on every request
const globalCacheMap = new Map<string, { cacheName: string; expiresAt: number }>();

async function getOrCreateGeminiCache(
  lessonId: string,
  mode: string,
  systemPrompt: string
): Promise<string> {
  const cacheKey = `${lessonId}_${mode}`;
  const cached = globalCacheMap.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.cacheName;
  }

  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not defined");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "models/gemini-2.0-flash-001",
      displayName: `copilot_cache_${lessonId}_${mode}`.replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 100),
      contents: [
        {
          role: "user",
          parts: [
            {
              text: systemPrompt,
            },
          ],
        },
      ],
      ttl: "300s",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Failed to create context cache in Gemini REST API: ${response.status} ${response.statusText} - ${errorBody}`
    );
  }

  const result = await response.json();
  const cacheName = result.name; // Format: cachedContents/xxxx

  globalCacheMap.set(cacheKey, {
    cacheName,
    expiresAt: Date.now() + 5 * 60 * 1000 - 15 * 1000, // 5 min TTL minus 15s buffer
  });

  return cacheName;
}

function getStableRandomIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) % length;
}

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      lessonId,
      currentCode,
      lastErrorLog,
      fallbackLessonTitle,
      fallbackLessonContent,
      mode = "tutor",
    } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "messages array is required" }, { status: 400 });
    }

    let lessonTitle = fallbackLessonTitle || "";
    let lessonContent = fallbackLessonContent || "";
    let recallNodesList: any[] = [];

    // 1. Resolve lesson data from database if possible
    if (lessonId) {
      try {
        const lessonRecord = await db.query.lessons.findFirst({
          where: eq(lessons.id, lessonId),
        });
        if (lessonRecord) {
          lessonTitle = lessonRecord.title;
          lessonContent = lessonRecord.rawContext || lessonRecord.content || "";
        }
        const sourceDoc = await db.query.sourceDocuments.findFirst({
          where: eq(sourceDocuments.lessonId, lessonId),
        });
        if (sourceDoc?.markdown) {
          lessonContent = sourceDoc.markdown;
        }
        recallNodesList = await db.query.lessonRecallNodes.findMany({
          where: eq(lessonRecallNodes.lessonId, lessonId),
        });
      } catch (dbErr) {
        console.warn(
          `[Copilot API] DB lookup failed for lessonId ${lessonId}, using fallback content:`,
          dbErr
        );
      }
    }

    // 2. Format dynamic system prompt based on mode
    let systemPrompt = "";

    if (mode === "socratic") {
      systemPrompt = `
You are a strict Socratic AI Tutor. Your only job is to guide the student using questions. You must never give direct answers, code solutions, or explanations. Only ask thought-provoking, guiding questions that lead the student to discover the answers themselves.

[LESSON CONTEXT]
Title: ${lessonTitle || "CS Lesson"}
Content:
${lessonContent || "No context content."}

[RECALL NODES]
${recallNodesList.map((n) => `- [${n.nodeType}] ${n.key}: ${n.summary}`).join("\n")}
`.trim();
    } else if (mode === "feynman") {
      systemPrompt = `
You act as a struggling student who needs the user to explain a lesson concept to them. Ask the user to explain the core concept of the lesson in simple terms. Point out parts of their explanation that are confusing or incomplete and ask them to explain it differently. Act like a curious peer trying to understand the lesson concept. Do not give explanations or teach. You are the student learning from the user.

[LESSON CONTEXT]
Title: ${lessonTitle || "CS Lesson"}
Content:
${lessonContent || "No context content."}

[RECALL NODES]
${recallNodesList.map((n) => `- [${n.nodeType}] ${n.key}: ${n.summary}`).join("\n")}
`.trim();
    } else if (mode === "review") {
      let quizConceptInfo = "";
      try {
        const errors = await db.select().from(userErrorMemory);
        if (errors && errors.length > 0) {
          const seed = messages[0]?.id || "default_seed";
          const selectedIndex = getStableRandomIndex(seed, errors.length);
          const randomError = errors[selectedIndex];
          quizConceptInfo = `Struggled Concept: "${randomError.concept}"\nError Context: "${randomError.errorContext}"`;
        } else {
          quizConceptInfo = "(No past concept errors found in the memory. Quiz the student on a core concept of the current lesson instead.)";
        }
      } catch (dbErr) {
        console.warn("[Copilot API] Failed to fetch userErrorMemory:", dbErr);
        quizConceptInfo = "(Could not load memory. Quiz the student on a core concept of the current lesson instead.)";
      }

      systemPrompt = `
You are an AI Review Quizzer. Your task is to quiz the student on a concept they have struggled with in the past.

Here is the concept they struggled with:
${quizConceptInfo}

Do not give the answer. Formulate a quiz question related to this concept and ask the student to solve it or explain it. Provide feedback on their response, and ask follow-up questions to help them master the concept.

[LESSON CONTEXT]
Title: ${lessonTitle || "CS Lesson"}
Content:
${lessonContent || "No context content."}

[RECALL NODES]
${recallNodesList.map((n) => `- [${n.nodeType}] ${n.key}: ${n.summary}`).join("\n")}
`.trim();
    } else {
      // Default: tutor
      systemPrompt = `
You are an elite AI Tutor. Never give out full code solutions. Instead, reference the lesson's core concepts, point out logical flaws in the student's current code, and ask guiding questions.

[LESSON CONTEXT]
Title: ${lessonTitle || "CS Lesson"}
Content:
${lessonContent || "No context content."}

[RECALL NODES]
${recallNodesList.map((n) => `- [${n.nodeType}] ${n.key}: ${n.summary}`).join("\n")}
`.trim();
    }

    // 3. Inject current code and error logs into the last user message
    const enrichedMessages = [...messages];
    const lastMessage = enrichedMessages[enrichedMessages.length - 1];
    if (lastMessage && lastMessage.role === "user") {
      lastMessage.content = `
[STUDENT WORKSPACE STATE]
Current Editor Code:
\`\`\`
${currentCode || ""}
\`\`\`

Active Test Failures / Error Logs:
${lastErrorLog || "None (All current test cases pass or code has not been run yet)."}

[STUDENT QUESTION]
${lastMessage.content}
`.trim();
    }

    // 4. Attempt context caching using Google REST API
    let cacheName: string | null = null;
    if (lessonId && process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      try {
        cacheName = await getOrCreateGeminiCache(
          lessonId,
          mode,
          systemPrompt
        );
      } catch (cacheErr) {
        console.warn("[Copilot API] Context caching creation failed, falling back to uncached stream:", cacheErr);
      }
    }

    // 5. streamText with context cache or fallback
    let result;
    if (cacheName) {
      console.log(`[Copilot API] Cache HIT / Created for mode "${mode}": ${cacheName}`);
      result = streamText({
        model: geminiFlash,
        messages: enrichedMessages,
        providerOptions: {
          google: {
            cachedContent: cacheName,
          },
        },
      });
    } else {
      console.log(`[Copilot API] Streaming without Context Caching for mode "${mode}" (uncached fallback)`);
      result = streamText({
        model: geminiFlash,
        messages: enrichedMessages,
        system: systemPrompt,
      });
    }

    return result.toTextStreamResponse();
  } catch (err: any) {
    console.error("[Copilot API] Execution error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to start Studio Copilot stream" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
