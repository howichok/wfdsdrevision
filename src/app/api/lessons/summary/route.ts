import { type NextRequest, NextResponse } from "next/server";
import { generateStructured, DocumentSummarySchema } from "@/lib/ai/gemini";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const structuredSummary = await generateStructured({
      schema: DocumentSummarySchema,
      prompt: `Analyze the following document and provide a structured summary with 5 key points and 3 tags:\n\n${text}`,
    });

    return NextResponse.json(structuredSummary);
  } catch (err: any) {
    console.error("Error generating summary:", err);
    return NextResponse.json({ error: err.message || "Failed to generate summary" }, { status: 500 });
  }
}
