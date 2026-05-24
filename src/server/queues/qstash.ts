import { Client } from "@upstash/qstash";
import { z } from "zod";

const qstash = new Client({ token: process.env.QSTASH_TOKEN! });

export const EmbedDocumentPayload = z.object({
  documentId: z.string().uuid(),
  userId: z.string().uuid(),
  chunkSize: z.number().int().positive().default(512),
});

export const ScrapeUrlPayload = z.object({
  url: z.string().url(),
  documentId: z.string().uuid().optional(),
  userId: z.string().uuid(),
});

export const ScrapeTeamsPayload = z.object({
  userId: z.string().uuid(),
  channelUrl: z.string().url(),
});

export const MarkSubmissionPayload = z.object({
  submissionId: z.string().uuid(),
});

export type JobType = "embed_document" | "scrape_url" | "scrape_teams" | "mark_submission";

type PayloadMap = {
  embed_document: z.infer<typeof EmbedDocumentPayload>;
  scrape_url: z.infer<typeof ScrapeUrlPayload>;
  scrape_teams: z.infer<typeof ScrapeTeamsPayload>;
  mark_submission: z.infer<typeof MarkSubmissionPayload>;
};

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function publishJob<T extends JobType>(
  type: T,
  payload: PayloadMap[T],
  options?: {
    delay?: number;
    retries?: number;
    deduplicationId?: string;
  }
) {
  return qstash.publishJSON({
    url: `${BASE_URL}/api/queue/webhook`,
    body: { type, payload },
    retries: options?.retries ?? 3,
    ...(options?.delay ? { delay: options.delay } : {}),
    ...(options?.deduplicationId
      ? { headers: { "Upstash-Deduplication-Id": options.deduplicationId } }
      : {}),
  });
}
