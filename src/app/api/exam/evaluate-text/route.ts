/**
 * POST /api/exam/evaluate-text
 *
 * Lightweight Ink-Highlighter Stream Route — Edge Runtime.
 *
 * Accepts a student's essay and streams individual, fully-formed annotation
 * objects as SSE events using Google Gemini's partialObjectStream.
 *
 * "Smart Client, Dumb Server" contract:
 *   - Server emits only: { targetText, type, feedback }
 *   - Client owns all DOM parsing, span injection, and animation.
 *
 * Stream format: text/event-stream
 *   data: {"targetText":"...","type":"highlight_good","feedback":"..."}
 *   data: [DONE]
 */
export const runtime = "edge";

import { type NextRequest } from "next/server";
import { streamObject } from "ai";
import { geminiFlash } from "@/lib/ai/gemini";
import { z } from "zod";

// ─── Shared schema (must stay in sync with TextHighlighterEngine.tsx) ─────────

export const AnnotationSchema = z.object({
  annotations: z
    .array(
      z.object({
        targetText: z
          .string()
          .describe(
            "The exact verbatim substring copied character-for-character from the student text."
          ),
        type: z
          .enum(["highlight_good", "highlight_bad"])
          .describe(
            "'highlight_good' for strong content; 'highlight_bad' for errors or weak points."
          ),
        feedback: z
          .string()
          .describe(
            "Concise educational note — maximum 15 words. Explain WHY this phrase is strong or needs work."
          ),
      })
    )
    .describe(
      "Ordered list of 4–8 inline annotations. Return an empty array only if the text is entirely unevaluable."
    ),
});

export type EvalAnnotation = z.infer<
  typeof AnnotationSchema
>["annotations"][number];

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM = `\
You are a senior academic examiner providing precise, inline feedback on a student's written answer.

Your job: identify specific phrases in the student's text that are either strong or need improvement.

STRICT RULES — follow exactly:
1. Each targetText MUST be an exact verbatim substring copied character-for-character from the student's text. No paraphrasing or rewording.
2. highlight_good → correct facts, sharp argumentation, precise terminology, well-structured logic.
3. highlight_bad  → factual errors, unsupported claims, vague phrasing, logical gaps, weak evidence.
4. feedback must be ≤ 15 words, actionable, and specific to the phrase.
5. Return 4–8 highlights total. Balance good and bad proportional to text quality.
6. Never highlight the same substring twice.
7. Never highlight stopwords, conjunctions, or phrases shorter than 3 words.`;

// ─── SSE helpers ──────────────────────────────────────────────────────────────

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

function sseEvent(data: string): Uint8Array {
  return new TextEncoder().encode(`data: ${data}\n\n`);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { text: string; questionText?: string };

  try {
    body = (await req.json()) as { text: string; questionText?: string };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { text, questionText } = body;

  if (!text || typeof text !== "string" || text.trim().length < 20) {
    return new Response(
      JSON.stringify({ error: "text must be at least 20 characters" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const prompt = [
    questionText ? `EXAM QUESTION:\n${questionText}\n` : "",
    `STUDENT ANSWER:\n${text}`,
    "\nIdentify the most important highlights in the student answer above.",
  ]
    .filter(Boolean)
    .join("\n");

  // Kick off the Gemini stream
  const result = streamObject({
    model: geminiFlash,
    schema: AnnotationSchema,
    system: SYSTEM,
    prompt,
  });

  // SSE stream: emit each annotation the moment it is fully formed.
  // An annotation at index i is complete once index i+1 has started streaming
  // (because JSON object fields are written sequentially) OR when the stream ends.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let emittedCount = 0;

      try {
        for await (const partial of result.partialObjectStream) {
          const annotations = partial.annotations ?? [];

          // Every annotation except the last one is guaranteed complete
          // once the next one has started appearing.
          const safeLimit = annotations.length - 1;

          while (emittedCount < safeLimit) {
            const ann = annotations[emittedCount];
            if (ann?.targetText && ann?.type && ann?.feedback) {
              controller.enqueue(sseEvent(JSON.stringify(ann)));
              emittedCount++;
            } else {
              break;
            }
          }
        }

        // Flush the final annotation after the stream ends (all fields complete)
        const finalObject = await result.object;
        const finalAnnotations = finalObject?.annotations ?? [];

        while (emittedCount < finalAnnotations.length) {
          const ann = finalAnnotations[emittedCount];
          if (ann?.targetText && ann?.type && ann?.feedback) {
            controller.enqueue(sseEvent(JSON.stringify(ann)));
          }
          emittedCount++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          sseEvent(JSON.stringify({ error: `Stream failed: ${msg}` }))
        );
      } finally {
        controller.enqueue(sseEvent("[DONE]"));
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
