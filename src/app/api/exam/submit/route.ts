import { type NextRequest, NextResponse } from "next/server";
import { gradeAttempt } from "@/lib/ai/marking";

interface ExamAnswerEntry {
  questionId: string;
  question: string;
  sampleAnswer: string;
  gradingCriteria: { criterion: string; maxPoints: number }[];
  userAnswer: string;
  marks: number;
}

export async function POST(req: NextRequest) {
  try {
    const { answers }: { answers: ExamAnswerEntry[] } = await req.json();

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: "No answers provided" }, { status: 400 });
    }

    // Grade each question concurrently
    const graded = await Promise.all(
      answers.map(async (entry) => {
        const feedback = await gradeAttempt({
          questionText: entry.question,
          gradingCriteria: entry.gradingCriteria,
          sampleAnswer: entry.sampleAnswer,
          userAnswer: entry.userAnswer || "(No answer provided)",
        });

        return {
          questionId: entry.questionId,
          question: entry.question,
          maxMarks: entry.marks,
          earnedScore: Math.round((feedback.score / 100) * entry.marks),
          feedback,
        };
      })
    );

    const totalEarned = graded.reduce((sum, q) => sum + q.earnedScore, 0);
    const totalPossible = graded.reduce((sum, q) => sum + q.maxMarks, 0);
    const overallPercent = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    const getGrade = (pct: number) => {
      if (pct >= 90) return "A*";
      if (pct >= 80) return "A";
      if (pct >= 70) return "B";
      if (pct >= 60) return "C";
      if (pct >= 50) return "D";
      return "U";
    };

    return NextResponse.json({
      results: graded,
      summary: {
        totalEarned,
        totalPossible,
        overallPercent,
        grade: getGrade(overallPercent),
      },
    });
  } catch (err: any) {
    console.error("Exam submit error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to grade exam" },
      { status: 500 }
    );
  }
}
