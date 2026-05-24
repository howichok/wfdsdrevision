"use server";

import { db } from "@/lib/db";
import { userErrorMemory } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MasteryUpdateItem {
  /** camelCase concept key matching a lesson_recall_nodes.key */
  conceptKey: string;
  /** Human-readable concept name (used as the `concept` column in user_error_memory) */
  conceptName: string;
  /** 0–100 normalised score the student achieved on this concept */
  score: number;
  /** Critique text from the AI grader — stored as error_context when score < 70 */
  critique: string;
}

export interface MasteryUpdateResult {
  success: boolean;
  processed: number;
  errors: { conceptKey: string; error: string }[];
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const FAILURE_THRESHOLD = 70; // scores below this update / create an error memory entry
const MASTERY_THRESHOLD = 85; // scores above this increment mastery score
const MAX_MASTERY_SCORE = 100; // hard cap on mastery_score column

// ─── Server Action ────────────────────────────────────────────────────────────

/**
 * Processes AI grading output and mutates the user_error_memory table:
 *
 * - score < 70  → upsert error memory, drop mastery_score, record critique as error_context
 * - score > 85  → increment mastery_score toward 100 (signals topic absorption)
 * - 70–85       → no-op (borderline pass, no state change)
 *
 * @param updates  Array of concept-level grading results
 * @returns        Success flag, processed count, and per-concept errors
 */
export async function updateMasteryFromExamResults(
  updates: MasteryUpdateItem[]
): Promise<MasteryUpdateResult> {
  // Guard: return a safe no-op for empty inputs
  if (!updates || updates.length === 0) {
    return { success: true, processed: 0, errors: [] };
  }

  const errors: MasteryUpdateResult["errors"] = [];
  let processed = 0;

  for (const item of updates) {
    const { conceptKey, conceptName, score, critique } = item;

    // Normalise score to integer, clamped to [0, 100]
    const normalisedScore = Math.max(0, Math.min(100, Math.round(score)));

    try {
      if (normalisedScore < FAILURE_THRESHOLD) {
        // ── FAILURE PATH ───────────────────────────────────────────────────
        // Derive a dropped mastery score: proportional penalty (max 50 out
        // of 100 based on how far below threshold they fell)
        const penalty = Math.round(
          ((FAILURE_THRESHOLD - normalisedScore) / FAILURE_THRESHOLD) * 50
        );
        const droppedMastery = Math.max(0, 50 - penalty);

        // Check whether a record already exists for this concept
        const existing = await db.query.userErrorMemory.findFirst({
          where: eq(userErrorMemory.concept, conceptName),
        });

        if (existing) {
          // Update: drop mastery and refresh error context
          await db
            .update(userErrorMemory)
            .set({
              masteryScore: Math.min(existing.masteryScore, droppedMastery),
              errorContext: critique,
            })
            .where(eq(userErrorMemory.id, existing.id));
        } else {
          // Insert: new weakness found
          await db.insert(userErrorMemory).values({
            concept: conceptName,
            errorContext: critique,
            masteryScore: droppedMastery,
          });
        }
      } else if (normalisedScore > MASTERY_THRESHOLD) {
        // ── MASTERY PATH ──────────────────────────────────────────────────
        // Increment mastery_score toward MAX_MASTERY_SCORE, or create entry
        // if the concept was never tracked before.
        const existing = await db.query.userErrorMemory.findFirst({
          where: eq(userErrorMemory.concept, conceptName),
        });

        if (existing) {
          const increment = Math.round(
            ((normalisedScore - MASTERY_THRESHOLD) / (100 - MASTERY_THRESHOLD)) * 15
          );
          const newScore = Math.min(
            MAX_MASTERY_SCORE,
            existing.masteryScore + increment
          );

          await db
            .update(userErrorMemory)
            .set({ masteryScore: newScore })
            .where(eq(userErrorMemory.id, existing.id));
        }
        // If no existing record at mastery level — concept was never a weakness,
        // no action needed (we only track errors and improvements).
      }
      // Borderline 70–85: intentional no-op

      processed++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[updateMasteryFromExamResults] Failed for concept "${conceptKey}":`,
        err
      );
      errors.push({ conceptKey, error: message });
    }
  }

  return {
    success: errors.length === 0,
    processed,
    errors,
  };
}
