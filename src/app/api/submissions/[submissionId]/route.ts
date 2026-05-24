import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

type RouteParams = {
  params: Promise<{
    submissionId: string;
  }>;
};

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { submissionId } = await params;

    if (!submissionId) {
      return NextResponse.json({ error: "Missing submissionId" }, { status: 400 });
    }

    const sub = await db.query.submissions.findFirst({
      where: eq(submissions.id, submissionId),
    });

    if (!sub) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    return NextResponse.json({
      status: sub.status,
      score: sub.score,
      feedback: sub.feedback,
      markedAt: sub.markedAt,
    });
  } catch (err: any) {
    console.error("Error retrieving submission status:", err);
    return NextResponse.json({ error: err.message || "Internal Server Error" }, { status: 500 });
  }
}
