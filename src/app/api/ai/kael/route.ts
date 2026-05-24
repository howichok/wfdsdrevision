export const runtime = "edge"

import { type NextRequest } from "next/server"
import { streamText } from "ai"
import { z } from "zod"
import {
  buildKaelSystemPrompt,
  getKaelModelForTier,
  KAEL_LOCKED_SCOPE_MESSAGE,
  KAEL_MISSING_CONTEXT_MESSAGE,
  normaliseKaelTier,
  normaliseRecalledContext,
  resolveKaelModelTier,
  shouldAskForContext,
  shouldLockScope,
} from "@/lib/ai/kael"

const kaelChatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .min(1),
  studentTier: z.string().optional(),
  recalledContext: z.string().optional(),
  pathway: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = kaelChatSchema.safeParse(body)

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid Kael payload", issues: parsed.error.flatten() }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }

    const { messages, studentTier, recalledContext, pathway } = parsed.data
    const tier = normaliseKaelTier(studentTier)
    const safeRecalledContext = normaliseRecalledContext(recalledContext)
    const lastUserMessage = [...messages].reverse().find((message) => message.role === "user")
    const userPrompt = lastUserMessage?.content ?? ""

    if (shouldLockScope(userPrompt, safeRecalledContext)) {
      return new Response(KAEL_LOCKED_SCOPE_MESSAGE, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Kael-Guardrail": "scope-lock" },
      })
    }

    if (shouldAskForContext(userPrompt, safeRecalledContext)) {
      return new Response(KAEL_MISSING_CONTEXT_MESSAGE, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Kael-Guardrail": "missing-context" },
      })
    }

    const system = buildKaelSystemPrompt({
      studentTier: tier,
      recalledContext: safeRecalledContext,
      pathwayOverride: pathway,
    })

    const routing = await resolveKaelModelTier({
      userPrompt,
      studentTier: tier,
      recalledContext: safeRecalledContext,
      messages,
    })

    const result = streamText({
      model: getKaelModelForTier(routing.tier),
      system,
      messages,
    })

    return result.toTextStreamResponse({
      headers: {
        "X-Kael-Model": routing.modelId,
        "X-Kael-Routing": routing.tier,
        "X-Kael-Routed-By": routing.routedBy,
      },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to start Kael stream"
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
