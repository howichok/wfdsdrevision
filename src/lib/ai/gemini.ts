import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamObject, generateObject, embed, embedMany } from "ai";
import { z } from "zod";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
});

export const geminiFlash = google("gemini-2.0-flash-001");
export const geminiPro = google("gemini-2.5-pro-preview-05-06");
export const geminiEmbedding = google.textEmbeddingModel("text-embedding-004");

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
