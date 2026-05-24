export const runtime = "edge";

import { type NextRequest } from "next/server";
import { streamObject } from "ai";
import { geminiFlash, DocumentSummarySchema } from "@/lib/ai/gemini";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const text = body?.text;

  if (!text || typeof text !== "string") {
    return new Response(JSON.stringify({ error: "text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = streamObject({
    model: geminiFlash,
    schema: DocumentSummarySchema,
    prompt: `Analyze the following document and provide a structured summary:\n\n${text}`,
  });

  return result.toTextStreamResponse();
}
