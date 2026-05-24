export const runtime = "edge";

import { type NextRequest } from "next/server";
import { streamText } from "ai";
import { geminiFlash } from "@/lib/ai/gemini";

export async function POST(req: NextRequest) {
  try {
    const { messages, lessonTitle, lessonContent } = await req.json();

    const systemPrompt = `You are a helpful and experienced computer science teacher.
You are teaching a lesson on: "${lessonTitle || "Database Systems"}".
Here is the lesson content/context:
${lessonContent || "No detailed context provided."}

Answer the student's questions in a clear, educational, and supportive manner. Break down complex terms, provide clear examples, and encourage active learning. Keep formatting clean.`;

    const result = streamText({
      model: geminiFlash,
      messages,
      system: systemPrompt,
    });

    return result.toTextStreamResponse();
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Failed to start AI chat stream" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
