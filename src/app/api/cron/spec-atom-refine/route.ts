import { type NextRequest, NextResponse } from "next/server";
import { runSpecAtomEnrichmentBatch } from "@/lib/ai/spec-atom-refiner";

export const runtime = "nodejs";

/**
 * Hourly spec atom enrichment — uses gemini-2.5-flash-lite.
 * Rotates through atoms: adds keywords, study angles, prerequisite edges,
 * overlap hints. Does NOT rewrite official terminology.
 *
 * Schedule (example): GET/POST every hour with Authorization: Bearer $CRON_SECRET
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[spec-atom-refine] Unauthorized cron attempt.");
      return new Response("Unauthorized", { status: 401 });
    }

    console.log("[spec-atom-refine] Starting hourly enrichment batch…");
    const result = await runSpecAtomEnrichmentBatch();

    return NextResponse.json({
      success: result.errors.length === 0 || result.processed > 0,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error("[spec-atom-refine] Error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
