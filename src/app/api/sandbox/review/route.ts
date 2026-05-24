/**
 * POST /api/sandbox/review
 *
 * Differential AI Code-Review Engine — Edge Runtime.
 *
 * Accepts the original and current file maps for a WebContainer workspace,
 * computes a unified-style textual diff, and invokes Google Gemini to produce
 * a structured array of inline review comments with precise line references.
 */
export const runtime = "edge";

import { type NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

// ─── Gemini client (edge-safe HTTP wrapper) ───────────────────────────────────

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

const reviewModel = google("gemini-2.5-pro-preview-05-06");

// ─── Output schema ────────────────────────────────────────────────────────────

const ReviewCommentSchema = z.object({
  filePath: z
    .string()
    .describe("Relative file path exactly as it appears in the workspace, e.g. 'src/index.ts'"),
  lineNumber: z
    .number()
    .int()
    .positive()
    .describe("1-indexed line number in the CURRENT (post-change) version of the file"),
  type: z
    .enum(["error", "warning", "optimization"])
    .describe(
      "'error' for bugs / broken logic / security issues; 'warning' for code smells or likely runtime problems; 'optimization' for performance or readability improvements"
    ),
  comment: z
    .string()
    .describe(
      "Precise, actionable feedback — explain WHY the change is problematic and HOW to fix it. Never be vague."
    ),
});

const ReviewResponseSchema = z.object({
  comments: z
    .array(ReviewCommentSchema)
    .describe(
      "Ordered list of inline review comments. Empty array if no issues are found."
    ),
});

// ─── Diff utility (edge-safe, no Node.js deps) ────────────────────────────────

/**
 * Produces a line-numbered unified diff between two strings.
 * Lines are prefixed with their 1-indexed position in the CURRENT file so the
 * AI can reference them precisely without recomputing positions.
 *
 * Uses a simple greedy scan: identical lines advance both pointers; differing
 * lines emit a removal then an addition.  Not a minimal-edit LCS diff, but
 * sufficient for Gemini's semantic analysis.
 */
function computeDiff(original: string, current: string, filePath: string): string {
  const origLines = original.split("\n");
  const currLines = current.split("\n");

  const out: string[] = [`--- a/${filePath}`, `+++ b/${filePath}`];

  let i = 0;
  let j = 0;

  while (i < origLines.length || j < currLines.length) {
    if (i >= origLines.length) {
      out.push(`+[L${j + 1}] ${currLines[j]}`);
      j++;
    } else if (j >= currLines.length) {
      out.push(`-[L${i + 1}] ${origLines[i]}`);
      i++;
    } else if (origLines[i] === currLines[j]) {
      out.push(` [L${j + 1}] ${currLines[j]}`);
      i++;
      j++;
    } else {
      out.push(`-[L${i + 1}] ${origLines[i]}`);
      out.push(`+[L${j + 1}] ${currLines[j]}`);
      i++;
      j++;
    }
  }

  return out.join("\n");
}

/**
 * Renders a file's current contents with 1-indexed line numbers so the AI can
 * unambiguously anchor comments.
 */
function renderWithLineNumbers(contents: string): string {
  return contents
    .split("\n")
    .map((line, idx) => `${String(idx + 1).padStart(4, " ")} | ${line}`)
    .join("\n");
}

// ─── Request / response types ─────────────────────────────────────────────────

interface ReviewRequest {
  originalFiles: Record<string, string>;
  currentFiles: Record<string, string>;
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: ReviewRequest;

  try {
    body = (await req.json()) as ReviewRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { originalFiles, currentFiles } = body;

  if (
    !originalFiles ||
    !currentFiles ||
    typeof originalFiles !== "object" ||
    typeof currentFiles !== "object"
  ) {
    return NextResponse.json(
      { error: "Both originalFiles and currentFiles are required" },
      { status: 400 }
    );
  }

  // ── Build diff context for each changed or new file ──────────────────────────
  const changedPaths = Object.keys(currentFiles).filter(
    (path) => currentFiles[path] !== (originalFiles[path] ?? "")
  );

  if (changedPaths.length === 0) {
    return NextResponse.json({ comments: [] });
  }

  const sections: string[] = [];

  for (const filePath of changedPaths) {
    const original = originalFiles[filePath] ?? "";
    const current = currentFiles[filePath] ?? "";

    sections.push([
      `═══════════════════════════════════════`,
      `FILE: ${filePath}`,
      `═══════════════════════════════════════`,
      "",
      "── Current file (with line numbers) ──",
      renderWithLineNumbers(current),
      "",
      "── Diff (− removed  + added  space unchanged) ──",
      computeDiff(original, current, filePath),
    ].join("\n"));
  }

  const diffPayload = sections.join("\n\n");

  // ── System instruction ────────────────────────────────────────────────────────
  const systemPrompt = `You are a world-class tech lead and principal engineer conducting a thorough Pull Request code review. Your job is to catch real problems before they reach production.

Review the provided diffs with extreme precision. For every issue you find, emit a structured comment targeting the exact line number in the CURRENT file version (shown in the numbered listing). Each line in the diff is prefixed with [L<number>] indicating its position in the current file.

WHAT TO FLAG (be specific and surgical):
• Bugs: logic errors, off-by-one errors, null/undefined dereference, type mismatches.
• Security: injection risks, unsafe eval, exposed secrets, missing input validation.
• Performance: unnecessary re-computation inside loops, synchronous blocking in async contexts, memory leaks.
• Correctness: broken invariants, missing edge-case handling (empty arrays, zero division, etc.).
• Code quality: dead code, misleading variable names, overly complex expressions that should be extracted.

WHAT TO IGNORE:
• Whitespace-only changes.
• Stylistic preferences with no impact on correctness or performance.
• Changes that are unambiguously correct improvements.

If the diff contains no real problems, return an empty comments array. Do NOT manufacture issues.`;

  const userPrompt = `Review the following workspace diff and emit inline comments:\n\n${diffPayload}`;

  // ── Invoke Gemini ─────────────────────────────────────────────────────────────
  try {
    const { object } = await generateObject({
      model: reviewModel,
      schema: ReviewResponseSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return NextResponse.json({ comments: object.comments });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[sandbox/review] Gemini generateObject error:", message);
    return NextResponse.json(
      { error: `AI review engine failed: ${message}` },
      { status: 502 }
    );
  }
}
