import { type NextRequest, NextResponse } from "next/server";
import { processUnprocessedSourceDocuments } from "@/lib/ai/lesson-generator";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("Unauthorized daily-lesson-trigger attempt.");
      return new Response("Unauthorized", { status: 401 });
    }

    console.log("Triggering daily lesson processing from source_documents...");

    const results = await processUnprocessedSourceDocuments();

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unprocessed source documents found. Job skipped.",
      });
    }

    return NextResponse.json({
      success: true,
      processedCount: results.length,
      lessons: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("Error in daily-lesson-trigger route:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
