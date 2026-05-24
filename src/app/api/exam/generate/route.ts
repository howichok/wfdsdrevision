import { type NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { geminiFlash } from "@/lib/ai/gemini";
import { z } from "zod";

export const ExamQuestionSchema = z.object({
  id: z.string().describe("A unique slug id like 'q1', 'q2'"),
  question: z.string().describe("The full exam question text"),
  marks: z.number().int().describe("Total marks allocated to this question"),
  type: z.enum(["short_answer", "essay", "explain"]),
  sampleAnswer: z.string().describe("Model answer used for grading"),
  gradingCriteria: z.array(
    z.object({
      criterion: z.string(),
      maxPoints: z.number().int(),
    })
  ),
});

export const GeneratedExamSchema = z.object({
  examTitle: z.string(),
  totalMarks: z.number().int(),
  duration: z.string().describe("e.g. '45 minutes'"),
  questions: z.array(ExamQuestionSchema),
});

export type GeneratedExam = z.infer<typeof GeneratedExamSchema>;

export async function POST(req: NextRequest) {
  try {
    const { topic, length, cognitiveTarget, weaknesses } = await req.json();

    const weaknessContext = weaknesses?.length
      ? `The student has shown weaknesses in: ${weaknesses.join(", ")}. Ensure at least one question targets each weak area.`
      : "";

    const prompt = `You are a computer science exam board setter.
Generate a ${length || "Standard (30 mins / 40 pts)"} exam paper on the topic: "${topic || "Database Systems"}".
Question type focus: ${cognitiveTarget || "Hybrid Exam Mock"}.
${weaknessContext}

Create a structured exam with 3-5 questions of varied difficulty. Each question must have:
- A clear question prompt
- Total marks
- Question type (short_answer, essay, or explain)
- A detailed model sample answer
- Granular marking criteria with point allocations

The exam questions must test exam-board level understanding, not trivial recall.`;

    const { object } = await generateObject({
      model: geminiFlash,
      schema: GeneratedExamSchema,
      prompt,
      system:
        "You are a professional UK GCSE/A-Level computer science exam setter producing rigorous, fair, and curriculum-aligned exam papers.",
    });

    return NextResponse.json(object);
  } catch (err: any) {
    console.error("Exam generation error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to generate exam" },
      { status: 500 }
    );
  }
}
