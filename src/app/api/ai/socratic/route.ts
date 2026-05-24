export const runtime = "edge";

import { type NextRequest } from "next/server";
import { streamText } from "ai";
import { geminiFlash } from "@/lib/ai/gemini";

export async function POST(req: NextRequest) {
  try {
    const { messages, lessonTitle, lessonContent } = await req.json();

    const systemPrompt = `You are a Socratic computer science tutor teaching a lesson on: "${lessonTitle || "Database Systems"}".

Here is the lesson context:
${lessonContent || "No detailed context provided."}

CRITICAL INSTRUCTIONS — Socratic Method ONLY:
- NEVER directly explain or reveal the answer.
- Instead, respond EXCLUSIVELY with guided questions that lead the student to discover the answer themselves.
- Ask one question at a time.
- If the student is on the right track, affirm briefly and ask a follow-up question that deepens their thinking.
- If the student is wrong, gently point out the flaw with a question that helps them reconsider.
- Keep responses short, focused, and encouraging.`;

    const result = streamText({
      model: geminiFlash,
      messages,
      system: systemPrompt,
    });

    return result.toTextStreamResponse();
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to start Socratic stream" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
