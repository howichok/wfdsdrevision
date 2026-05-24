#!/usr/bin/env node
/**
 * Trigger spec atom enrichment via the cron route.
 * Requires the app running locally OR set NEXT_PUBLIC_APP_URL to production.
 */
const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
const secret = process.env.CRON_SECRET;

async function main() {
  const headers = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const response = await fetch(`${base}/api/cron/spec-atom-refine`, {
    method: "POST",
    headers,
  });

  const body = await response.json().catch(() => ({}));
  console.log(JSON.stringify(body, null, 2));

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
