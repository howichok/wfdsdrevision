import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamObject, generateObject, embed, embedMany } from "ai";
import { z } from "zod";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

/** Stable Gemini model IDs — keep routing logic here only. */
export const GEMINI_MODEL_IDS = {
  /** Default for chat, summaries, grading, hints, copilot, etc. */
  simple: "gemini-2.5-flash-lite",
  /** Reserved for multi-step generation, deep audits, and heavy structured pipelines. */
  superComplex: "gemini-3.1-flash-lite",
} as const;

export type GeminiTaskTier = "simple" | "super-complex";

/** Legacy alias used across routes — maps to simple tier. */
export type GeminiModelAlias = "flash" | "pro" | GeminiTaskTier;

export const geminiFlash = google(GEMINI_MODEL_IDS.simple);
export const geminiSuperComplex = google(GEMINI_MODEL_IDS.superComplex);

/** @deprecated Use geminiSuperComplex — kept for existing `model: "pro"` call sites. */
export const geminiPro = geminiSuperComplex;

export const geminiEmbedding = google.textEmbeddingModel("text-embedding-004");

export function resolveGeminiTier(model: GeminiModelAlias = "simple"): GeminiTaskTier {
  if (model === "pro" || model === "super-complex") return "super-complex";
  return "simple";
}

export function getGeminiModel(tier: GeminiTaskTier = "simple") {
  return tier === "super-complex" ? geminiSuperComplex : geminiFlash;
}

export function getGeminiModelForAlias(model: GeminiModelAlias = "simple") {
  return getGeminiModel(resolveGeminiTier(model));
}

export function getGeminiModelId(tier: GeminiTaskTier = "simple") {
  return tier === "super-complex" ? GEMINI_MODEL_IDS.superComplex : GEMINI_MODEL_IDS.simple;
}

/** Google REST cachedContents expects `models/<id>`. */
export function getGeminiModelResourceId(tier: GeminiTaskTier = "simple") {
  return `models/${getGeminiModelId(tier)}`;
}

export function streamStructured<T extends z.ZodType>({
  model = geminiFlash,
  schema,
  prompt,
  system,
}: {
  model?: ReturnType<typeof google>;
  schema: T;
  prompt: string;
  system?: string;
}) {
  return streamObject({ model, schema, prompt, ...(system ? { system } : {}) });
}

export async function generateStructured<T extends z.ZodType>({
  model = geminiFlash,
  schema,
  prompt,
  system,
}: {
  model?: ReturnType<typeof google>;
  schema: T;
  prompt: string;
  system?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any> {
  const { object } = await generateObject({
    model,
    schema,
    prompt,
    ...(system ? { system } : {}),
  });
  return object;
}

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: geminiEmbedding, value: text });
  return embedding;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({ model: geminiEmbedding, values: texts });
  return embeddings;
}

export const DocumentSummarySchema = z.object({
  summary: z.string().describe("A concise 2-3 sentence summary"),
  keyPoints: z.array(z.string()).describe("Up to 5 key bullet points"),
  tags: z.array(z.string()).describe("Relevant topic tags"),
  sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
});

export type DocumentSummary = z.infer<typeof DocumentSummarySchema>;
