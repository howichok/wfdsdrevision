import { generateObject } from "ai";
import { z } from "zod";
import { eq, asc, and } from "drizzle-orm";
import { db } from "@/lib/db";
import { specAtomEdges, specAtoms, specPathways } from "@/lib/db/schema";
import { geminiFlash } from "@/lib/ai/gemini";

const ENRICHMENT_VERSION = 1;

const SpecAtomEnrichmentSchema = z.object({
  relatedAtomExternalIds: z
    .array(z.string())
    .max(5)
    .describe("Other atom external IDs closely related in the curriculum graph"),
  suggestedPrerequisiteIds: z
    .array(z.string())
    .max(3)
    .describe("External IDs that should be learned before this atom"),
  additionalKeywords: z
    .array(z.string())
    .max(8)
    .describe("Extra search/link keywords — never duplicate the title wording"),
  studyAngles: z
    .array(z.string())
    .max(3)
    .describe("Practical ways to revise or demonstrate this atom"),
  commonMisconceptions: z
    .array(z.string())
    .max(3)
    .describe("Typical student mistakes for this atom"),
  overlaps: z
    .array(
      z.object({
        externalId: z.string(),
        relationship: z.enum([
          "supports",
          "extends",
          "prerequisite",
          "assessed_by",
          "duplicate_risk",
        ]),
        reason: z.string().max(160),
      })
    )
    .max(4),
  completenessScore: z.number().min(0).max(100),
  enrichNotes: z.string().max(240),
  clearHumanReview: z.boolean(),
});

export type SpecAtomEnrichment = z.infer<typeof SpecAtomEnrichmentSchema>;

export interface SpecEnrichmentRunResult {
  pathwayId: string;
  processed: number;
  edgesAdded: number;
  skipped: number;
  errors: string[];
}

function defaultBatchSize(): number {
  const parsed = Number(process.env.SPEC_ENRICHMENT_BATCH_SIZE ?? 10);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 25) : 10;
}

function enrichmentEnabled(): boolean {
  return process.env.SPEC_ENRICHMENT_ENABLED !== "false";
}

function readRefinement(metadata: unknown): { lastRunAt?: string } | null {
  if (!metadata || typeof metadata !== "object") return null;
  const refinement = (metadata as { refinement?: { lastRunAt?: string } }).refinement;
  return refinement ?? null;
}

async function fetchCandidateAtoms(pathwayId: string, batchSize: number) {
  const atoms = await db.query.specAtoms.findMany({
    where: eq(specAtoms.pathwayId, pathwayId),
    columns: {
      id: true,
      externalId: true,
      componentSlug: true,
      moduleSlug: true,
      learningOutcomeId: true,
      title: true,
      statement: true,
      keywords: true,
      evidenceTypes: true,
      metadata: true,
      needsHumanReview: true,
    },
  });

  return atoms
    .sort((a, b) => {
      const aTime = readRefinement(a.metadata)?.lastRunAt ?? "";
      const bTime = readRefinement(b.metadata)?.lastRunAt ?? "";
      if (aTime === bTime) return a.externalId.localeCompare(b.externalId);
      return aTime.localeCompare(bTime);
    })
    .slice(0, batchSize);
}

async function fetchModuleContext(pathwayId: string, moduleSlug: string, excludeId: string) {
  return db
    .select({
      externalId: specAtoms.externalId,
      title: specAtoms.title,
      learningOutcomeId: specAtoms.learningOutcomeId,
      componentSlug: specAtoms.componentSlug,
    })
    .from(specAtoms)
    .where(
      and(
        eq(specAtoms.pathwayId, pathwayId),
        eq(specAtoms.moduleSlug, moduleSlug)
      )
    )
    .limit(12)
    .then((rows) => rows.filter((row) => row.externalId !== excludeId));
}

async function enrichSingleAtom(
  atom: Awaited<ReturnType<typeof fetchCandidateAtoms>>[number],
  modulePeers: Awaited<ReturnType<typeof fetchModuleContext>>,
  validExternalIds: Set<string>
): Promise<SpecAtomEnrichment | null> {
  const peerList = modulePeers
    .map((peer) => `- ${peer.externalId}: ${peer.title} (LO ${peer.learningOutcomeId ?? "n/a"})`)
    .join("\n");

  const { object } = await generateObject({
    model: geminiFlash,
    schema: SpecAtomEnrichmentSchema,
    system: `You enrich T Level spec atoms for a revision platform.

STRICT RULES:
- Do NOT rewrite, paraphrase, or "improve" the atom title or statement terminology.
- Only add structural learning metadata: relationships, prerequisites, study angles, misconceptions, keywords for search/linking.
- suggestedPrerequisiteIds and relatedAtomExternalIds MUST be chosen ONLY from the provided peer external IDs.
- If unsure, return empty arrays and a lower completenessScore.
- clearHumanReview=true only when the atom looks complete and unambiguous.`,
    prompt: `Enrich this spec atom without changing its official wording.

Atom ID: ${atom.externalId}
Component: ${atom.componentSlug}
Module: ${atom.moduleSlug}
Learning outcome: ${atom.learningOutcomeId ?? "unknown"}
Title: ${atom.title}
Statement: ${atom.statement}
Existing keywords: ${(atom.keywords ?? []).join(", ") || "(none)"}
Needs human review: ${atom.needsHumanReview}

Module peers (valid external IDs):
${peerList || "(no peers in module)"}

Return structural enrichment only.`,
  });

  const sanitiseIds = (ids: string[]) =>
    ids.filter((id) => validExternalIds.has(id) && id !== atom.externalId);

  return {
    ...object,
    relatedAtomExternalIds: sanitiseIds(object.relatedAtomExternalIds),
    suggestedPrerequisiteIds: sanitiseIds(object.suggestedPrerequisiteIds),
    overlaps: object.overlaps.filter(
      (overlap) => validExternalIds.has(overlap.externalId) && overlap.externalId !== atom.externalId
    ),
  };
}

async function applyEnrichment(
  pathwayId: string,
  atom: Awaited<ReturnType<typeof fetchCandidateAtoms>>[number],
  enrichment: SpecAtomEnrichment,
  idByExternal: Map<string, string>
): Promise<number> {
  const mergedKeywords = [
    ...new Set([...(atom.keywords ?? []), ...enrichment.additionalKeywords.map((k) => k.trim())]),
  ].filter(Boolean);

  const existingMetadata =
    atom.metadata && typeof atom.metadata === "object"
      ? (atom.metadata as Record<string, unknown>)
      : {};

  const refinement = {
    version: ENRICHMENT_VERSION,
    lastRunAt: new Date().toISOString(),
    completenessScore: enrichment.completenessScore,
    studyAngles: enrichment.studyAngles,
    commonMisconceptions: enrichment.commonMisconceptions,
    relatedAtomExternalIds: enrichment.relatedAtomExternalIds,
    overlaps: enrichment.overlaps,
    enrichNotes: enrichment.enrichNotes,
  };

  await db
    .update(specAtoms)
    .set({
      keywords: mergedKeywords,
      needsHumanReview:
        enrichment.clearHumanReview && enrichment.completenessScore >= 70
          ? false
          : atom.needsHumanReview,
      metadata: {
        ...existingMetadata,
        refinement,
      },
      updatedAt: new Date(),
    })
    .where(eq(specAtoms.id, atom.id));

  let edgesAdded = 0;
  const targetId = atom.id;

  for (const prerequisiteExternalId of enrichment.suggestedPrerequisiteIds) {
    const fromAtomId = idByExternal.get(prerequisiteExternalId);
    if (!fromAtomId || fromAtomId === targetId) continue;

    const existing = await db
      .select({ id: specAtomEdges.id })
      .from(specAtomEdges)
      .where(
        and(
          eq(specAtomEdges.pathwayId, pathwayId),
          eq(specAtomEdges.fromAtomId, fromAtomId),
          eq(specAtomEdges.toAtomId, targetId),
          eq(specAtomEdges.edgeType, "prerequisite")
        )
      )
      .limit(1);
    if (existing.length > 0) continue;

    await db.insert(specAtomEdges).values({
      pathwayId,
      fromAtomId,
      toAtomId: targetId,
      edgeType: "prerequisite",
    });
    edgesAdded += 1;
  }

  return edgesAdded;
}

export async function runSpecAtomEnrichmentBatch(): Promise<SpecEnrichmentRunResult> {
  if (!enrichmentEnabled()) {
    return {
      pathwayId: "",
      processed: 0,
      edgesAdded: 0,
      skipped: 0,
      errors: ["Spec enrichment disabled (SPEC_ENRICHMENT_ENABLED=false)"],
    };
  }

  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return {
      pathwayId: "",
      processed: 0,
      edgesAdded: 0,
      skipped: 0,
      errors: ["GOOGLE_GENERATIVE_AI_API_KEY is not set"],
    };
  }

  const pathway = await db.query.specPathways.findFirst({
    orderBy: asc(specPathways.createdAt),
  });

  if (!pathway) {
    return {
      pathwayId: "",
      processed: 0,
      edgesAdded: 0,
      skipped: 0,
      errors: ["No spec pathway imported yet. Run npm run spec:import"],
    };
  }

  const batchSize = defaultBatchSize();
  const batch = await fetchCandidateAtoms(pathway.id, batchSize);

  if (batch.length === 0) {
    return {
      pathwayId: pathway.id,
      processed: 0,
      edgesAdded: 0,
      skipped: 0,
      errors: [],
    };
  }

  const allAtoms = await db.query.specAtoms.findMany({
    where: eq(specAtoms.pathwayId, pathway.id),
    columns: { id: true, externalId: true },
  });
  const idByExternal = new Map(allAtoms.map((row) => [row.externalId, row.id]));
  const validExternalIds = new Set(allAtoms.map((row) => row.externalId));

  let processed = 0;
  let edgesAdded = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const atom of batch) {
    try {
      const modulePeers = await fetchModuleContext(pathway.id, atom.moduleSlug, atom.externalId);
      const enrichment = await enrichSingleAtom(atom, modulePeers, validExternalIds);
      if (!enrichment) {
        skipped += 1;
        continue;
      }

      edgesAdded += await applyEnrichment(pathway.id, atom, enrichment, idByExternal);
      processed += 1;

      await new Promise((resolve) => setTimeout(resolve, 250));
    } catch (error) {
      skipped += 1;
      errors.push(
        `${atom.externalId}: ${error instanceof Error ? error.message : " enrichment failed"}`
      );
    }
  }

  const pathwayMeta =
    pathway.meta && typeof pathway.meta === "object"
      ? (pathway.meta as Record<string, unknown>)
      : {};

  await db
    .update(specPathways)
    .set({
      meta: {
        ...pathwayMeta,
        enrichment: {
          lastRunAt: new Date().toISOString(),
          lastBatchSize: batch.length,
          lastProcessed: processed,
          lastEdgesAdded: edgesAdded,
          model: "gemini-2.5-flash-lite",
        },
      },
      updatedAt: new Date(),
    })
    .where(eq(specPathways.id, pathway.id));

  return {
    pathwayId: pathway.id,
    processed,
    edgesAdded,
    skipped,
    errors,
  };
}
