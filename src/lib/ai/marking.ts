import { z } from "zod";
import { extractStructured } from "./instructor";

// Zod schema for structured grading feedback from Gemini
export const GradeFeedbackSchema = z.object({
  score: z.number().min(0).max(100).describe("Overall percentage score out of 100"),
  grade: z.string().describe("A/B/C/D/F grade representing the score"),
  strengths: z.array(z.string()).describe("A list of positive aspects of the user's answer"),
  improvements: z.array(z.string()).describe("Specific areas of improvement or topics missing from the answer"),
  rubricEvaluation: z.array(
    z.object({
      criterion: z.string().describe("The grading criteria item"),
      passed: z.boolean().describe("Whether the student successfully covered this criterion"),
      feedback: z.string().describe("Specific explanation of how they covered or missed this point"),
    })
  ).describe("Granular breakdown of the user's answer against each rubric point"),
  modelComparison: z.string().describe("A comparison highlighting what they did well or poorly compared to the sample answer"),
  refinedAnswer: z.string().describe("A model revision of the user's answer that corrects mistakes and improves flow"),
});

export type GradeFeedback = z.infer<typeof GradeFeedbackSchema>;

// Zod schemas for generating revision questions from uploaded materials/channel posts
export const GeneratedQuestionSchema = z.object({
  title: z.string().describe("Concise and descriptive title of the revision question"),
  text: z.string().describe("The revision question prompt, challenging the student to explain or solve something from the material"),
  type: z.enum(["short_answer", "essay", "multiple_choice", "code"]).describe("The question format"),
  difficulty: z.enum(["easy", "medium", "hard"]).describe("Difficulty level of the question"),
  sampleAnswer: z.string().describe("A model answer that contains all the necessary knowledge points"),
  gradingCriteria: z.array(
    z.object({
      criterion: z.string().describe("Specific key concept, formula, or keyword that must be covered in the answer"),
      maxPoints: z.number().int().positive().describe("Maximum points for this criterion"),
    })
  ).describe("Strict rubrics for grading this question"),
});

export const GeneratedQuestionsSchema = z.object({
  topicTitle: z.string().describe("A descriptive topic/module title (e.g., 'Newtonian Mechanics', 'Binary Trees')"),
  topicDescription: z.string().describe("A brief summary of what this topic covers based on the material"),
  questions: z.array(GeneratedQuestionSchema).describe("List of practice questions generated from the text"),
});

export type GeneratedQuestions = z.infer<typeof GeneratedQuestionsSchema>;

/**
 * Evaluates a user's answer against the question text, criteria, and sample answer using Gemini.
 */
export async function gradeAttempt({
  questionText,
  gradingCriteria,
  sampleAnswer,
  userAnswer,
  model = "flash",
}: {
  questionText: string;
  gradingCriteria: any;
  sampleAnswer: string | null;
  userAnswer: string;
  model?: "flash" | "pro";
}): Promise<GradeFeedback> {
  const rubricString = Array.isArray(gradingCriteria)
    ? gradingCriteria.map((c: any) => `- ${c.criterion} (Points: ${c.maxPoints || c.points || 1})`).join("\n")
    : JSON.stringify(gradingCriteria);

  const prompt = `
    You are an expert academic evaluator. Your task is to grade a student's answer to a revision question.
    
    Here is the question they were asked:
    ---
    ${questionText}
    ---
    
    ${sampleAnswer ? `Here is the ideal sample answer for reference:\n---\n${sampleAnswer}\n---` : ""}
    
    Here is the marking rubric / grading criteria:
    ---
    ${rubricString}
    ---
    
    Here is the student's answer to mark:
    ---
    ${userAnswer}
    ---
    
    Be constructive, accurate, and fair. Evaluate their response rigorously against each item in the grading criteria. If they have covered the gist of a criterion, mark it as passed, but provide clear feedback on how they can make it more precise.
  `;

  const system = "You are a professional educational assessor that grades submissions, assigns clear percentages, verifies specific rubrics, and provides highly actionable feedback.";

  const object = await extractStructured({
    schema: GradeFeedbackSchema,
    prompt,
    system,
    model,
  });

  return object as GradeFeedback;
}

/**
 * Analyzes educational material (message board posts, downloaded files, slides) and generates revision questions.
 */
export async function generateQuestionsFromMaterial({
  materialText,
  sourceContext,
  model = "flash",
}: {
  materialText: string;
  sourceContext?: string;
  model?: "flash" | "pro";
}): Promise<GeneratedQuestions> {
  const prompt = `
    Analyze the following educational material and generate a set of structured revision questions.
    
    ${sourceContext ? `Source Context (e.g. Channel or File Name): ${sourceContext}` : ""}
    
    Educational Material Content:
    ---
    ${materialText}
    ---
    
    Based on this material:
    1. Identify the core topic/module name and write a brief summary description.
    2. Generate between 1 and 4 revision questions of various types and difficulty levels (easy, medium, hard).
    3. For each question, provide a detailed, accurate model sample answer.
    4. For each question, define a list of specific, granular grading criteria (rubric items) with associated maxPoints (e.g., covering critical keywords, definitions, or steps).
    
    Ensure that the questions directly reflect what is taught in the material so that students can practice effectively.
  `;

  const system = "You are an curriculum designer and educational content creator. You extract critical syllabus topics from raw notes, posts, and files, converting them into high-quality questions, sample answers, and rubrics.";

  const object = await extractStructured({
    schema: GeneratedQuestionsSchema,
    prompt,
    system,
    model,
  });

  return object as GeneratedQuestions;
}
