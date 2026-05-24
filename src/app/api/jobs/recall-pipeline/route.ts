import { type NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { db } from "@/lib/db";
import {
  lessons,
  lessonRecallNodes,
  lessonChallenges,
  sourceDocuments,
} from "@/lib/db/schema";
import { streamObject } from "ai";
import { geminiFlash } from "@/lib/ai/gemini";
import { embedText } from "@/lib/ai/gemini";
import { extractStructured } from "@/lib/ai/instructor";
import { markdownToPlainText } from "@/lib/scraping/markdown-builder";
import { z } from "zod";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const LessonStructureSchema = z.object({
  title: z.string().describe("An engaging, descriptive name for the lesson plan based on the Teams content"),
  objectives: z.array(z.string()).describe("A list of 3-5 clear student learning objectives"),
  concepts: z.array(z.string()).describe("A list of key technical concepts covered in this lesson"),
  editorPlaceholder: z.object({
    type: z.literal("doc"),
    content: z.array(
      z.object({
        type: z.string().describe("Paragraph, heading, bulletList, orderedList, or codeBlock"),
        attrs: z.record(z.string(), z.any()).optional().describe("For heading (level: 1, 2, 3) or codeBlock (language: 'javascript', 'python')"),
        content: z.array(
          z.object({
            type: z.string().describe("text or other inline nodes"),
            text: z.string().optional(),
            marks: z.array(z.any()).optional(),
          })
        ).optional(),
      })
    ),
  }).describe("A high-fidelity Tiptap JSON document skeleton with sections like Introduction, Main Material, Exercises, and code blocks or blank sections for teachers to edit"),
});

const RecallNodesAndChallengesSchema = z.object({
  nodes: z.array(
    z.object({
      nodeType: z.enum(["core_concept", "syntax_rule", "prerequisite", "common_pitfall"]),
      key: z.string().describe("Unique camelCase identifier for this unit of knowledge"),
      summary: z.string().describe("Concise 1-2 sentence description of the concept or rule"),
      metadata: z.object({
        codeSnippet: z.string().optional().describe("Example code snippet if applicable"),
        referenceUrl: z.string().optional().describe("Reference link or source name"),
        contextNotes: z.string().optional().describe("Additional context notes"),
        language: z.string().optional().describe("Programming language or tech stack name"),
        codeBlocks: z.array(
          z.object({
            code: z.string().describe("A single line or block of code"),
            correctOrder: z.number().int().describe("The correct 0-based index of this block in the final program"),
          })
        ).optional().describe("Exactly 3 code blocks representing a 3-step linear code pipeline (Parson's Problems) for sorting game"),
      }).describe("Metadata block containing language-specific properties, reference links, code blocks, etc."),
    })
  ).describe("Granular, microscopic items of knowledge extracted from the lesson structure"),
  challenges: z.array(
    z.object({
      language: z.enum(["python", "javascript"]),
      title: z.string().describe("Descriptive title of the programming challenge"),
      description: z.string().describe("Clear instructions detailing what function to write, input arguments, and expected behavior"),
      starterCode: z.string().describe("Starter function stub displayed to the student (e.g. 'def solution(x):' or 'function solution(x) {')"),
      testSuite: z.array(
        z.object({
          input: z.string().describe("The JSON-stringified argument array passed to the function (e.g. '[5]' or '[\"hello\", 12]')"),
          expectedOutput: z.string().describe("The JSON-stringified expected return value of the function (e.g. '10' or '\"olleh\"')"),
          hiddenAssertionScript: z.string().optional().describe("Optional JS/Python test assertion command or custom runner check"),
        })
      ).describe("Suite of test cases, must have at least 3-5 cases including typical values and corner cases"),
    })
  ).describe("1-2 programming challenges related to the lesson context"),
});

async function handler(req: NextRequest) {
  let lessonId: string | null = null;
  let sourceDocumentId: string | undefined;
  try {
    const body = await req.json().catch(() => ({}));
    lessonId = body.lessonId;
    sourceDocumentId = body.sourceDocumentId;

    if (!lessonId) {
      return NextResponse.json(
        { error: "lessonId is required" },
        { status: 400 }
      );
    }

    console.log(`Starting Recall Agentic Pipeline for lesson ${lessonId}...`);

    const lesson = await db.query.lessons.findFirst({
      where: eq(lessons.id, lessonId),
    });

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    const rawContext = lesson.rawContext || lesson.content || "";
    if (!rawContext.trim()) {
      return NextResponse.json(
        { error: "Lesson has no raw context to process" },
        { status: 400 }
      );
    }

    await db
      .update(lessons)
      .set({ status: "processing" })
      .where(eq(lessons.id, lessonId));

    let finalizedDraft: z.infer<typeof LessonStructureSchema>;
    try {
      console.log("[Step 1/3] Generating initial structured draft...");
      const initialDraft = await extractStructured({
        schema: LessonStructureSchema,
        model: "super-complex",
        prompt: `Generate an initial structured lesson plan based on this raw classroom discussion text:\n\n${rawContext}`,
        system: "You are an expert curriculum designer. Break down chat context into clear title, objectives, concepts, and a high-fidelity editor draft.",
      });

      console.log("[Step 2/3] Performing AI self-critique and correction loop...");
      finalizedDraft = await extractStructured({
        schema: LessonStructureSchema,
        model: "super-complex",
        prompt: `Original Raw Context:\n${rawContext}\n\nInitial Layout Draft:\n${JSON.stringify(initialDraft, null, 2)}`,
        system: `You are a strict curriculum auditor and reviewer.
Your job is to identify gaps, omissions, formatting problems, or conceptual errors in the initial layout draft when compared to the original raw discussion logs.
Produce a fully revised, complete, and corrected lesson plan JSON structure.`,
      });
    } catch (apiErr: unknown) {
      console.error("AI drafting/self-correction stage failed:", apiErr);
      throw apiErr;
    }

    console.log("[Step 3/3] Extracting deep recall nodes and coding challenges...");
    const recallPrompt = `Based on this finalized corrected lesson plan, extract:
1. Microscopic units of knowledge (core concepts, syntax rules, prerequisites, common pitfalls).
2. 1-2 practical code challenges matching the lesson's topics with realistic test suites.

Lesson Structure:
${JSON.stringify(finalizedDraft, null, 2)}`;

    const { object: recallObjectStream } = streamObject({
      model: geminiFlash,
      schema: RecallNodesAndChallengesSchema,
      prompt: recallPrompt,
      system: `You are a knowledge graph and programming challenge extractor.
Extract granular, atomic units of knowledge as nodes.
Additionally, extract 1-2 coding challenges related to the lesson context.`,
    });

    const recallResult = await recallObjectStream;
    const nodes = recallResult.nodes || [];
    const challenges = recallResult.challenges || [];

    const nodesToInsert = await Promise.all(
      nodes.map(async (node) => {
        const textToEmbed = `${node.key}: ${node.summary}`;
        let embedding: number[] | null = null;
        try {
          embedding = await embedText(textToEmbed);
        } catch (embedErr) {
          console.warn(`Failed to generate embedding for node ${node.key}:`, embedErr);
        }
        return {
          lessonId: lessonId!,
          nodeType: node.nodeType,
          key: node.key,
          summary: node.summary,
          metadata: node.metadata,
          embedding,
        };
      })
    );

    if (nodesToInsert.length > 0) {
      await db.insert(lessonRecallNodes).values(nodesToInsert);
    }

    if (challenges.length > 0) {
      await db.insert(lessonChallenges).values(
        challenges.map((ch) => ({
          lessonId: lessonId!,
          title: ch.title,
          description: ch.description,
          language: ch.language,
          starterCode: ch.starterCode,
          testSuite: ch.testSuite,
        }))
      );
    }

    const plainContent = markdownToPlainText(rawContext);
    const fallbackTextContent = plainContent.slice(0, 8000) || `
# Objectives
${finalizedDraft.objectives.map((o) => `- ${o}`).join("\n")}

# Key Concepts
${finalizedDraft.concepts.map((c) => `- ${c}`).join("\n")}
    `.trim();

    await db
      .update(lessons)
      .set({
        title: finalizedDraft.title,
        content: fallbackTextContent,
        structuredContent: finalizedDraft,
        status: "placeholder",
        updatedAt: new Date(),
      })
      .where(eq(lessons.id, lessonId));

    if (sourceDocumentId) {
      await db
        .update(sourceDocuments)
        .set({ isProcessed: true, updatedAt: new Date() })
        .where(eq(sourceDocuments.id, sourceDocumentId));
    } else {
      await db
        .update(sourceDocuments)
        .set({ isProcessed: true, updatedAt: new Date() })
        .where(eq(sourceDocuments.lessonId, lessonId));
    }

    console.log(`Recall Pipeline completed successfully for lesson ${lessonId}.`);
    return NextResponse.json({
      success: true,
      lessonId,
      extractedNodesCount: nodesToInsert.length,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    console.error(`Error executing recall pipeline for lesson ${lessonId}:`, err);
    if (lessonId) {
      try {
        await db
          .update(lessons)
          .set({ status: "failed" })
          .where(eq(lessons.id, lessonId));
      } catch (dbErr) {
        console.error("Failed to mark lesson status as failed:", dbErr);
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const POST =
  process.env.NODE_ENV === "development" || !process.env.QSTASH_CURRENT_SIGNING_KEY
    ? handler
    : verifySignatureAppRouter(handler);
