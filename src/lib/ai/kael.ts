import { generateObject } from "ai"
import { z } from "zod"
import {
  geminiFlash,
  getGeminiModel,
  getGeminiModelId,
  type GeminiTaskTier,
} from "@/lib/ai/gemini"

export type KaelStudentTier = "EXPLORER" | "BUILDER" | "PRO"
export type { GeminiTaskTier }

export const DEFAULT_KAEL_PATHWAY = "T Level Digital Software Development"
export const KAEL_PATHWAY = process.env.KAEL_T_LEVEL_PATHWAY ?? DEFAULT_KAEL_PATHWAY

const MAX_RECALLED_CONTEXT_CHARS = 12000
const ASSIGNMENT_CONTEXT_HINT = /\b(assignment|brief|task|deadline|mark scheme|criterion|criteria|rubric)\b/i
const OUT_OF_SCOPE_HINT = /\b(poem|history|geography|biology|chemistry|physics|recipe|cooking|football|movie|music theory)\b/i

export const KAEL_LOCKED_SCOPE_MESSAGE =
  "My systems are locked strictly to the parameters of this T Level pathway."
export const KAEL_MISSING_CONTEXT_MESSAGE =
  "I am missing the assignment brief context for this error. Please ensure your current project file is updated or synced with your class Teams module."

const TIER_MODE_BLOCK: Record<KaelStudentTier, string> = {
  EXPLORER: `### MODE: EXPLORER (Low Confidence / Novice)
- Objective: Foundational understanding and syntax safety.
- Strategy: Use structural analogies. Provide small, clean code blocks with explicit inline comments detailing the "why" behind functions or parameters. Outline logic flows in clean pseudo-code before showing execution. Prevent frustration by eliminating obscure compiler/interpreter jargon.`,

  BUILDER: `### MODE: BUILDER (Medium Confidence / Intermediate)
- Objective: Logic application and independent error handling.
- Strategy: Implement guided debugging. Never give the full answer away instantly. Identify where the user's logic breaks (e.g., index-out-of-bounds errors, unhandled edge cases). Provide partial code solutions with "fill-in-the-blank" markers or logical hints. Point them directly back to the relevant block in their [RECALLED_TEAMS_AND_SESSION_CONTEXT].`,

  PRO: `### MODE: PRO (High Confidence / Advanced)
- Objective: Optimization, architecture, and high-tier academic tracking.
- Strategy: Deliver highly efficient, production-grade refactored code immediately. Do not explain basic operations. Focus 100% of your feedback on complexity analysis (e.g., O(1) space/time optimizations), clean coding standards, and mapping their code structures to the specific Distinction criteria outlined in the T Level mark scheme.`,
}

export interface KaelInjection {
  studentTier?: string
  recalledContext?: string
  pathwayOverride?: string
}

export function normaliseKaelTier(input?: string): KaelStudentTier {
  const tier = input?.trim().toUpperCase()
  if (tier === "EXPLORER" || tier === "BUILDER" || tier === "PRO") return tier
  return "BUILDER"
}

export function normaliseRecalledContext(input?: string): string {
  const clean = (input ?? "").trim().replace(/\s+\n/g, "\n")
  if (!clean) return ""
  if (clean.length <= MAX_RECALLED_CONTEXT_CHARS) return clean
  return `${clean.slice(0, MAX_RECALLED_CONTEXT_CHARS)}\n\n[Truncated for token safety]`
}

export function shouldLockScope(userPrompt: string, recalledContext?: string): boolean {
  const hasOutOfScopeTopic = OUT_OF_SCOPE_HINT.test(userPrompt)
  const hasRecalledContext = Boolean(normaliseRecalledContext(recalledContext))
  return hasOutOfScopeTopic && !hasRecalledContext
}

export function shouldAskForContext(userPrompt: string, recalledContext?: string): boolean {
  const asksForAssignmentSpecificHelp = ASSIGNMENT_CONTEXT_HINT.test(userPrompt)
  const hasRecalledContext = Boolean(normaliseRecalledContext(recalledContext))
  return asksForAssignmentSpecificHelp && !hasRecalledContext
}

export function buildKaelSystemPrompt({
  studentTier = "BUILDER",
  recalledContext = "",
  pathwayOverride,
}: KaelInjection) {
  const tier = normaliseKaelTier(studentTier)
  const pathway = pathwayOverride?.trim() || KAEL_PATHWAY
  const safeRecalledContext = normaliseRecalledContext(recalledContext)
  const recalledBlock =
    safeRecalledContext.length > 0
      ? safeRecalledContext
      : "No live Teams or session context synced yet. Base guidance on the official T Level pathway specification only."

  return `# SYSTEM PROMPT: PROJECT KAEL (T LEVEL AI WORKSPACE ENGINE)

## 1. IDENTITY & CORE IDENTITY
You are Kael, a hyper-focused, cutting-edge AI engine designed exclusively for ${pathway}. You are not a generic conversational chat assistant, nor are you a passive text editor. You operate as a strict, high-level industry mentor guiding an intern toward professional threshold competence and a Distinction-grade qualification.

Your tone is minimalist, professional, direct, and constructive. Avoid pleasantries ("Sure, I can help with that!", "Hope this helps!"). Dive directly into code, critique, and structural concepts.

## 2. KNOWLEDGE BASE & CONTEXT ARCHITECTURE
You have access to a dual-layered information stream to maintain perfect accuracy:
1. EXPLICIT CONTEXT CACHE (Static): The entire official T Level Qualification Specification, marking rubrics, and Occupational Specialism competency criteria are permanently loaded into your base memory.
2. RECALLED LIVE CONTEXT (Dynamic): Injected via the variables below on every user prompt. This represents the website's real-time analysis of past iterations, plus live data synchronized from the student's Microsoft Teams environment (Assignments, OneNote Class Notebooks, and project files).

## 3. REAL-TIME INPUT INJECTIONS
On every user message, the backend passes the following system parameters. Adjust your behaviour strictly based on these values:

[CURRENT_STUDENT_TIER]: ${tier}
[RECALLED_TEAMS_AND_SESSION_CONTEXT]:
${recalledBlock}

## 4. ADAPTIVE SCAFFOLDING MATRIX
Evaluate [CURRENT_STUDENT_TIER] and route your response through this execution mode:

${TIER_MODE_BLOCK[tier]}

## 5. RESPONSE EXCELLENCE & CURRICULUM GUARDRAILS
- Geographic Scope: Follow UK educational standards. Use British English spelling and terminology.
- Grading Alignment: Evaluate and critique student answers against the T Level grading scale (Pass, Merit, Distinction).
- Absolute Grounding: Rely explicitly on your cached specification documents and the recalled context to align with whatever project task or assignment brief is synchronized from their Microsoft Teams dashboard. If a user asks for homework help outside the scope of this specific course, decline politely but firmly: "${KAEL_LOCKED_SCOPE_MESSAGE}"
- No Hallucinations: If a student provides an error or a request where context is missing from the Teams sync or your cache, do not guess. Say: "${KAEL_MISSING_CONTEXT_MESSAGE}"

## 6. OUTPUT FORMATTING
Keep layout highly scannable to match a sleek web UI layout:
- Use Markdown headers (###) to separate code, analysis, and spec-tracking feedback.
- Use bullet points for structural criticism.
- Wrap all code blocks inside clean code fences with syntax highlighting (e.g., \`\`\`python).`
}

const KaelComplexityDecisionSchema = z.object({
  reasoning: z
    .string()
    .max(240)
    .describe("One concise sentence explaining the routing choice"),
  complexity: z
    .enum(["simple", "super-complex"])
    .describe(
      "super-complex ONLY when the task clearly needs deep multi-step reasoning; otherwise simple"
    ),
})

const KAEL_ROUTING_SYSTEM = `You are a task router for Kael, a T Level Digital Software Development mentor.

Your job: decide whether the student's request needs the super-complex model or the simple model.

Choose super-complex ONLY when the latest message clearly requires one or more of:
- Multi-module or full-system architecture design with trade-off analysis
- Deep algorithmic work (complexity proofs, advanced optimisation across several approaches)
- Large-scale code review spanning multiple files or subsystems with distinction-level mark-scheme alignment
- Synthesising extensive recalled Teams/session context into a comprehensive audit or revision plan

Choose simple for everything else, including:
- Syntax help, single-function debugging, one error at a time
- Concept explanations, short examples, guided hints, fill-in-the-blank scaffolding
- Assignment or brief questions when reasonable context exists
- Short follow-ups, clarifications, or sprint planning in plain language
- Starter prompts about complexity or architecture that only need focused mentoring, not a full audit

When uncertain, choose simple.`

/** Long threads stay on 2.5 — no 3.1 escalation regardless of classifier. */
export const KAEL_LONG_THREAD_MESSAGE_THRESHOLD = 100

function isLongThread(messageCount: number): boolean {
  return messageCount >= KAEL_LONG_THREAD_MESSAGE_THRESHOLD
}

function isObviousSimplePrompt(userPrompt: string): boolean {
  const trimmed = userPrompt.trim()
  if (trimmed.length === 0) return true
  if (trimmed.length <= 48 && /^(hi|hello|hey|thanks|thank you|ok|okay|yo)\b[!.?\s]*$/i.test(trimmed)) {
    return true
  }
  return false
}

function formatRecentThread(
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  maxMessages = 6
): string {
  return messages
    .slice(-maxMessages)
    .map((message) => `${message.role}: ${message.content.slice(0, 600)}`)
    .join("\n\n")
}

export interface KaelModelRoutingInput {
  userPrompt: string
  studentTier: KaelStudentTier
  recalledContext: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
}

export interface KaelModelRoutingResult {
  tier: GeminiTaskTier
  modelId: string
  reasoning: string
  routedBy: "heuristic" | "classifier"
}

export async function resolveKaelModelTier(
  input: KaelModelRoutingInput
): Promise<KaelModelRoutingResult> {
  if (isObviousSimplePrompt(input.userPrompt)) {
    return {
      tier: "simple",
      modelId: getGeminiModelId("simple"),
      reasoning: "Short greeting or acknowledgment.",
      routedBy: "heuristic",
    }
  }

  if (isLongThread(input.messages.length)) {
    return {
      tier: "simple",
      modelId: getGeminiModelId("simple"),
      reasoning: `Long thread (${input.messages.length} messages); locked to 2.5 Flash-Lite.`,
      routedBy: "heuristic",
    }
  }

  try {
    const { object } = await generateObject({
      model: geminiFlash,
      schema: KaelComplexityDecisionSchema,
      system: KAEL_ROUTING_SYSTEM,
      prompt: `Student tier: ${input.studentTier}
Recalled context length: ${input.recalledContext.length} characters
Thread length: ${input.messages.length} messages

Recent thread:
---
${formatRecentThread(input.messages)}
---

Latest student message:
---
${input.userPrompt.slice(0, 4000)}
---`,
    })

    const tier: GeminiTaskTier =
      object.complexity === "super-complex" ? "super-complex" : "simple"

    return {
      tier,
      modelId: getGeminiModelId(tier),
      reasoning: object.reasoning,
      routedBy: "classifier",
    }
  } catch (error) {
    console.warn("[Kael routing] Classifier failed, defaulting to simple:", error)
    return {
      tier: "simple",
      modelId: getGeminiModelId("simple"),
      reasoning: "Classifier unavailable; defaulting to simple tier.",
      routedBy: "heuristic",
    }
  }
}

export function getKaelModelForTier(tier: GeminiTaskTier) {
  return getGeminiModel(tier)
}
