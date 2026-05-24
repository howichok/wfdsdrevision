// Structured extraction with retry logic via Vercel AI SDK's generateObject.
// instructor-js wraps OpenAI clients; for Gemini we use generateObject natively.
import { generateObject } from "ai";
import { z } from "zod";
import { geminiFlash, geminiPro } from "./gemini";

const MAX_RETRIES = 3;

export async function extractStructured<T extends z.ZodType>({
  schema,
  prompt,
  system,
  model = "flash",
  retries = MAX_RETRIES,
}: {
  schema: T;
  prompt: string;
  system?: string;
  model?: "flash" | "pro";
  retries?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any> {
  const llm = model === "pro" ? geminiPro : geminiFlash;
  let lastError: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { object } = await generateObject({
        model: llm,
        schema,
        prompt,
        ...(system ? { system } : {}),
      });
      return object;
    } catch (err) {
      lastError = err;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      }
    }
  }

  throw lastError;
}
