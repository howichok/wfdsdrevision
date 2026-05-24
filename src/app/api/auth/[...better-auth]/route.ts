import { auth } from "@/lib/auth/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const runtime = "nodejs";

const handler = toNextJsHandler(auth);

async function withAuthErrorLogging(
  method: "GET" | "POST",
  req: Request
): Promise<Response> {
  try {
    return await handler[method](req);
  } catch (error) {
    console.error(`[auth] ${method} failed:`, error);
    const message = error instanceof Error ? error.message : "Authentication error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return withAuthErrorLogging("GET", req);
}

export async function POST(req: Request) {
  return withAuthErrorLogging("POST", req);
}
