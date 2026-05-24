import { type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { userErrorMemory } from "@/lib/db/schema";
import { geminiFlash } from "@/lib/ai/gemini";
import { generateText } from "ai";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

const defaultErrors = [
  {
    concept: "Normalization",
    errorContext: "Confused 2NF with 3NF by leaving transitive functional dependencies in the table.",
    localSolution: "Ensure every non-key column depends directly on the primary key, removing transitive dependencies to another non-key column.",
  },
  {
    concept: "Partial Dependency",
    errorContext: "Created a composite key but allowed a non-key column to depend on only one part of the key.",
    localSolution: "Move columns that depend on only part of a composite key into a separate table to satisfy 2NF.",
  },
  {
    concept: "Atomic values",
    errorContext: "Stored a comma-separated list of telephone numbers in a single 'phone' field.",
    localSolution: "Store only a single indivisible value in each column field to satisfy the 1st Normal Form.",
  },
  {
    concept: "Foreign Key Constraint",
    errorContext: "Attempted to delete a record in a parent table while referencing records in a child table still existed.",
    localSolution: "Use ON DELETE CASCADE or remove the dependent child records first to maintain referential integrity.",
  },
  {
    concept: "SQL Injection",
    errorContext: "Concatenated raw input string directly into a database query string instead of using parameterized queries.",
    localSolution: "Use parameterized queries, placeholders, or an ORM to separate SQL instructions from user inputs.",
  }
];

export async function GET(req: NextRequest) {
  try {
    // 1. Fetch errors from database
    let errors: any[] = [];
    try {
      errors = await db.select().from(userErrorMemory);
    } catch (dbErr) {
      console.warn("Failed to query database, using local fallback:", dbErr);
    }

    // 2. If empty, seed the table
    if (errors.length === 0) {
      try {
        await db.insert(userErrorMemory).values(
          defaultErrors.map(e => ({
            concept: e.concept,
            errorContext: e.errorContext,
            masteryScore: 0,
          }))
        );
        // Fetch again after seeding
        errors = await db.select().from(userErrorMemory);
      } catch (dbErr) {
        console.error("Failed to seed database, falling back to local memory:", dbErr);
        // Fallback to local array mapping
        errors = defaultErrors.map((e, idx) => ({
          id: `local-id-${idx}`,
          concept: e.concept,
          errorContext: e.errorContext,
          masteryScore: 0,
          embedding: null,
          createdAt: new Date(),
        })) as any;
      }
    }

    // 3. For each error, generate a 1-sentence solution using Gemini
    // falling back to local solutions if Gemini fails or is not configured.
    const resolvedErrors = await Promise.all(
      errors.map(async (err: any) => {
        const fallback = defaultErrors.find(
          (de) => de.concept.toLowerCase() === err.concept.toLowerCase()
        );
        const fallbackSolution = fallback?.localSolution || "Review this concept to master its implementation.";

        try {
          const response = await generateText({
            model: geminiFlash,
            prompt: `Concept: "${err.concept}"
Error context: "${err.errorContext}"

Generate a single-sentence direct correction or solution explaining how to fix this specific mistake. Keep it concise, simple, and direct. Do not add introductory or concluding remarks.`,
          });

          return {
            ...err,
            solution: response.text.trim() || fallbackSolution,
          };
        } catch (geminiErr) {
          return {
            ...err,
            solution: fallbackSolution,
          };
        }
      })
    );

    return Response.json(resolvedErrors);
  } catch (err: any) {
    console.error("Error in error-memory route:", err);
    return new Response(JSON.stringify({ error: err.message || "Failed to fetch error memory" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { updates } = await req.json();
    if (!updates || !Array.isArray(updates)) {
      return Response.json({ error: "Invalid updates format" }, { status: 400 });
    }

    for (const update of updates) {
      if (update.id && typeof update.masteryScore === "number") {
        try {
          // If it's a mock local ID, skip database write
          if (update.id.startsWith("local-id-")) {
            continue;
          }
          await db
            .update(userErrorMemory)
            .set({ masteryScore: update.masteryScore })
            .where(eq(userErrorMemory.id, update.id));
        } catch (dbErr) {
          console.error(`Failed to update mastery score for ${update.id}:`, dbErr);
        }
      }
    }

    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message || "Failed to update scores" }, { status: 500 });
  }
}
