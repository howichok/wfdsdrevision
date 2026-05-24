import { type NextRequest } from "next/server";
import { streamText } from "ai";
import { geminiFlash } from "@/lib/ai/gemini";
import { db } from "@/lib/db";
import { aiSemanticCache } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

// Do NOT use Edge runtime because of node-postgres TCP socket requirements
export const runtime = "nodejs";

let serverExtractor: any = null;

async function getServerEmbedding(text: string): Promise<number[]> {
  try {
    const { pipeline } = await import("@huggingface/transformers");
    if (!serverExtractor) {
      serverExtractor = await pipeline(
        "feature-extraction",
        "onnx-community/all-MiniLM-L6-v2-ONNX"
      );
    }
    const output = await serverExtractor(text, { pooling: "mean", normalize: true });
    return Array.from(output.data) as number[];
  } catch (err) {
    console.error("Failed to generate embedding on the server:", err);
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { messages, lessonTitle, lessonContent } = body;
    let { embedding } = body;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const lastUserMessage = messages[messages.length - 1];
    const promptText = lastUserMessage.content;

    // 1. Get or generate the query vector
    if (!embedding || !Array.isArray(embedding)) {
      try {
        embedding = await getServerEmbedding(promptText);
      } catch (err) {
        console.warn("Could not generate server-side embedding, skipping semantic cache check.");
      }
    }

    // 2. Perform Cosine Similarity check on the database if embedding is available
    if (embedding && Array.isArray(embedding) && embedding.length === 384) {
      try {
        const threshold = 0.92;
        // pgvector cosine distance is <=>. Cosine similarity is 1 - distance.
        const matches = await db
          .select({
            id: aiSemanticCache.id,
            promptText: aiSemanticCache.promptText,
            responseJson: aiSemanticCache.responseJson,
          })
          .from(aiSemanticCache)
          .where(sql`1 - (embedding <=> ${JSON.stringify(embedding)}::vector) > ${threshold}`)
          .orderBy(sql`1 - (embedding <=> ${JSON.stringify(embedding)}::vector) DESC`)
          .limit(1);

        if (matches && matches.length > 0) {
          const match = matches[0];
          console.log(`[Semantic Cache HIT] Match found. Prompt: "${match.promptText.substring(0, 40)}..."`);
          
          // Construct a mock stream or return the cached JSON directly.
          // The prompt specifies: "if a match is found above a 0.92 threshold, return the cached answer immediately."
          // Since the client expects a streaming or standard chat response, we can return the response text in a format
          // compatible with standard UI clients. We will output the response json.
          const cachedResponse = match.responseJson as { text: string };
          
          // Return a Response object containing the text
          return new Response(cachedResponse.text, {
            status: 200,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "X-Semantic-Cache-Hit": "true",
            },
          });
        }
      } catch (dbErr) {
        console.error("Database semantic cache lookup failed (pgvector might be disabled):", dbErr);
      }
    }

    // 3. Cache MISS: Query Gemini via Vercel AI SDK
    const systemPrompt = `You are a helpful and experienced computer science teacher.
You are teaching a lesson on: "${lessonTitle || "Database Systems"}".
Here is the lesson content/context:
${lessonContent || "No detailed context provided."}

Answer the student's questions in a clear, educational, and supportive manner. Break down complex terms, provide clear examples, and encourage active learning. Keep formatting clean.`;

    const result = streamText({
      model: geminiFlash,
      messages,
      system: systemPrompt,
      async onFinish({ text }) {
        // Asynchronously save to semantic cache
        if (embedding && Array.isArray(embedding) && embedding.length === 384) {
          try {
            await db.insert(aiSemanticCache).values({
              promptText,
              embedding,
              responseJson: { text },
            });
            console.log("[Semantic Cache WRITE] Successfully cached new prompt-response pair.");
          } catch (writeErr) {
            console.error("Failed to write to semantic cache:", writeErr);
          }
        }
      },
    });

    return result.toTextStreamResponse();
  } catch (err: any) {
    console.error("Error in cached-chat route:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to process chat" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
