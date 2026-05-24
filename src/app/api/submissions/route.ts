import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { submissions } from "@/lib/db/schema";
import { requireAuth, AuthError, authErrorResponse } from "@/lib/auth/permissions";
import { publishJob } from "@/server/queues/qstash";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const { questionId, userAnswer } = await req.json();

    if (!questionId || !userAnswer) {
      return NextResponse.json(
        { error: "Missing questionId or userAnswer" },
        { status: 400 }
      );
    }

    const [sub] = await db
      .insert(submissions)
      .values({
        userId: user.id,
        questionId,
        userAnswer,
        status: "pending",
      })
      .returning();

    await publishJob("mark_submission", { submissionId: sub.id });

    return NextResponse.json({ ok: true, submissionId: sub.id });
  } catch (err) {
    if (err instanceof AuthError) return authErrorResponse(err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
