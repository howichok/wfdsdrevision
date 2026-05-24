"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion"
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Clock3,
  Layers3,
  SendHorizonal,
  Sparkles,
  Loader2,
  Zap,
  Check,
  Copy,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import ReactMarkdown from "react-markdown"

import type { KaelStudentTier } from "@/lib/ai/kael"
import { KaelAvatar } from "@/components/kael/KaelAvatar"
import { KaelShell } from "@/components/kael/KaelShell"
import { KaelLogo } from "@/components/kael/KaelLogo"
import {
  fetchRevisionScopeContext,
  KaelRevisionScopeStrip,
  loadStoredRevisionScope,
  storeRevisionScope,
} from "@/components/kael/KaelRevisionScopeStrip"
import { KAEL_COURSE, KAEL_NAME, KAEL_TAGLINE } from "@/lib/kael"
import { useAppStore } from "@/store/app.store"
import { cn } from "@/lib/utils"
import {
  DEFAULT_REVISION_SCOPE,
  describeRevisionScope,
  type RevisionLessonOption,
  type RevisionScope,
} from "@/lib/revision/revision-scope"

interface ChatMessage {
  id: string
  role: "assistant" | "user"
  content: string
}

interface LessonPayload {
  lesson?: { rawContext?: string | null; content?: string | null }
}

interface AuthMePayload {
  user?: { role?: string } | null
}

const COURSE_NAME = KAEL_COURSE
const AI_NAME = KAEL_NAME

const THINKING_PHRASES = [
  "Reading your question…",
  "Parsing assignment intent…",
  "Loading T Level Digital Software Development spec…",
  "Scanning Pass / Merit / Distinction criteria…",
  "Cross-referencing Teams session context…",
  "Identifying logic breakpoints…",
  "Mapping evidence to occupational standards…",
  "Applying scaffolding mode…",
  "Drafting criterion-aligned feedback…",
  "Structuring code and analysis blocks…",
  "Validating against mark scheme…",
  "Finalising response…",
] as const

const STARTERS: {
  prompt: string
  title: string
  subtitle: string
  icon: LucideIcon
}[] = [
  {
    prompt: "Map my assignment brief to Pass, Merit, and Distinction criteria.",
    title: "Criteria map",
    subtitle: "Evidence plan by grade band",
    icon: CalendarDays,
  },
  {
    prompt: "Debug this logic and tell me where my approach breaks before giving the final fix.",
    title: "Guided debug",
    subtitle: "Find fault points first",
    icon: Layers3,
  },
  {
    prompt: "Refactor my code to production grade and explain the complexity trade-offs.",
    title: "Pro refactor",
    subtitle: "Complexity + clean architecture",
    icon: ClipboardList,
  },
  {
    prompt: "Set a 30-minute revision sprint from my latest Teams context.",
    title: "Sprint plan",
    subtitle: "Context-aware micro session",
    icon: Clock3,
  },
]

async function streamKaelReply(
  history: ChatMessage[],
  injection: {
    studentTier: KaelStudentTier
    recalledContext: string
  },
  onDelta: (text: string) => void,
  signal?: AbortSignal
) {
  const response = await fetch("/api/ai/kael", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      studentTier: injection.studentTier,
      recalledContext: injection.recalledContext,
      pathway: COURSE_NAME,
    }),
    signal,
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null
    throw new Error(
      typeof payload?.error === "string" ? payload.error : "Kael could not respond"
    )
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("No response stream from Kael")

  const decoder = new TextDecoder()
  let full = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    full += decoder.decode(value, { stream: true })
    onDelta(full)
  }

  return full
}

function MarkdownCode({
  className,
  children,
  ...props
}: {
  className?: string
  children?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const code = String(children || "").replace(/\n$/, "")
  const match = /language-(\w+)/.exec(className || "")
  const lang = match ? match[1] : ""

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!match && !code.includes("\n")) {
    return (
      <code className={cn("rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs font-mono", className)} {...props}>
        {children}
      </code>
    )
  }

  return (
    <div className="kael-code-block my-4">
      <div className="kael-code-header">
        <span className="capitalize">{lang || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5"
          aria-label="Copy code snippet"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto bg-slate-900 p-4 text-[13.5px] text-slate-100 scrollbar-thin dark:bg-slate-950">
        <code className={className} {...props}>
          {children}
        </code>
      </pre>
    </div>
  )
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none text-[15px] leading-relaxed prose-headings:mb-2 prose-headings:mt-3 prose-headings:text-sm prose-headings:font-semibold prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-pre:my-0 prose-pre:bg-transparent prose-pre:p-0 prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        components={{
          pre({ children }) {
            return <div className="my-1">{children}</div>
          },
          code: MarkdownCode,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

/* ── Chat components ─────────────────────────────────────────────────────── */

function ThinkingBubble({ reduceMotion }: { reduceMotion: boolean | null }) {
  const [phraseIndex, setPhraseIndex] = useState(0)

  useEffect(() => {
    if (reduceMotion) return

    const intervalId = window.setInterval(() => {
      setPhraseIndex((current) => (current + 1) % THINKING_PHRASES.length)
    }, 1100)

    return () => window.clearInterval(intervalId)
  }, [reduceMotion])

  const phrase = THINKING_PHRASES[phraseIndex]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className="flex items-end gap-2.5"
      aria-live="polite"
      aria-busy="true"
    >
      <KaelAvatar reduceMotion={reduceMotion} size="sm" />

      <div className="min-w-[220px] max-w-[85%] rounded-2xl rounded-tl-sm border border-slate-200/50 bg-slate-50/80 px-4 py-3 sm:max-w-[75%] dark:border-slate-800/40 dark:bg-slate-900/60 shadow-sm">
        {reduceMotion ? (
          <p className="text-sm text-slate-500">Kael is thinking…</p>
        ) : (
          <div className="flex items-center gap-2.5">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-500/70" aria-hidden />
            <div className="relative min-h-5 flex-1 overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.p
                  key={phrase}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm text-slate-500 dark:text-slate-400"
                >
                  {phrase}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

function ChatBubble({
  message,
  isStreaming,
  reduceMotion,
  spring,
}: {
  message: ChatMessage
  isStreaming?: boolean
  reduceMotion: boolean | null
  spring: Transition
}) {
  const isAi = message.role === "assistant"

  return (
    <motion.div
      layout={!reduceMotion}
      initial={
        reduceMotion
          ? { opacity: 0 }
          : {
              opacity: 0,
              x: isAi ? -28 : 28,
              y: 14,
              scale: 0.94,
              filter: "blur(8px)",
            }
      }
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" }}
      transition={spring}
      className={cn("flex gap-2.5", isAi ? "justify-start" : "justify-end")}
    >
      {isAi ? <KaelAvatar reduceMotion={reduceMotion} size="sm" /> : null}

      <motion.div
        whileHover={reduceMotion ? undefined : { scale: 1.002 }}
        className={cn(
          "relative max-w-[85%] overflow-hidden px-4 py-3 sm:max-w-[75%]",
          isAi
            ? "rounded-2xl rounded-tl-sm border border-slate-200/50 bg-slate-50/80 text-slate-800 dark:border-slate-800/40 dark:bg-slate-900/65 dark:text-slate-100 shadow-sm backdrop-blur-sm"
            : "rounded-2xl rounded-tr-sm bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-600/10"
        )}
      >
        {isAi && !reduceMotion ? (
          <motion.div
            className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-blue-500/5"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
        ) : null}

        {!isAi && !reduceMotion ? (
          <motion.div
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-white/0 via-white/15 to-white/0"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          />
        ) : null}

        <p className="relative mb-1 text-[10px] font-semibold uppercase tracking-wider opacity-60">
          {isAi ? AI_NAME : "You"}
        </p>

        {isAi ? (
          <div className="relative" aria-live={isStreaming ? "polite" : undefined}>
            <AssistantMarkdown content={message.content} />
            {isStreaming ? (
              <motion.span
                className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-indigo-500 align-middle"
                animate={{ opacity: [1, 0.15, 1] }}
                transition={{ duration: 0.6, repeat: Infinity }}
                aria-hidden
              />
            ) : null}
          </div>
        ) : (
          <p className="relative leading-relaxed text-[15px]">{message.content}</p>
        )}
      </motion.div>
    </motion.div>
  )
}

function StarterChip({
  starter,
  index,
  reduceMotion,
  spring,
  onSelect,
}: {
  starter: (typeof STARTERS)[number]
  index: number
  reduceMotion: boolean | null
  spring: Transition
  onSelect: (prompt: string) => void
}) {
  return (
    <motion.button
      type="button"
      initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring, delay: reduceMotion ? 0 : 0.1 + index * 0.07 }}
      whileHover={
        reduceMotion
          ? undefined
          : {
              y: -4,
              scale: 1.02,
              boxShadow: "0 10px 25px rgba(99, 102, 241, 0.08)",
            }
      }
      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
      onClick={() => onSelect(starter.prompt)}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/80 p-3.5 text-left backdrop-blur-sm transition-all duration-200 hover:border-indigo-400/50 dark:border-slate-800/80 dark:bg-slate-950/80 dark:hover:border-indigo-500/30 shadow-sm"
    >
      {!reduceMotion ? (
        <motion.div
          className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-blue-500/5 opacity-0 transition-opacity group-hover:opacity-100"
          layout={false}
        />
      ) : null}
      <div className="relative flex items-start gap-3">
        <motion.span
          className="inline-flex h-8.5 w-8.5 shrink-0 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 group-hover:scale-105 group-hover:rotate-6 transition-all duration-200"
        >
          <starter.icon className="h-4 w-4" />
        </motion.span>
        <span>
          <span className="block text-xs font-semibold text-slate-850 dark:text-slate-200">{starter.title}</span>
          <span className="mt-0.5 block text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{starter.subtitle}</span>
        </span>
      </div>
    </motion.button>
  )
}

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function WelcomePage() {
  const reduceMotion = useReducedMotion()
  const activeDocument = useAppStore((state) => state.activeDocument)
  const messageIdRef = useRef(1)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  
  // Initialize with empty message history to support custom welcome dashboard state
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isThinking, setIsThinking] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)
  const [studentTier, setStudentTier] = useState<KaelStudentTier>("BUILDER")
  const [recalledContext, setRecalledContext] = useState("")
  const [revisionScope, setRevisionScope] = useState<RevisionScope>(DEFAULT_REVISION_SCOPE)
  const [revisionLessons, setRevisionLessons] = useState<RevisionLessonOption[]>([])
  const [revisionContextBlock, setRevisionContextBlock] = useState("")
  const [revisionScopeLoading, setRevisionScopeLoading] = useState(false)
  const streamAbortRef = useRef<AbortController | null>(null)

  const spring: Transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 380, damping: 26 }

  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    container.scrollTo({
      top: container.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    })
  }, [reduceMotion])

  const isStreamingReply = streamingMessageId !== null
  const isStarterState = messages.length === 0 && !isThinking && !isStreamingReply
  const canSend = input.trim().length > 0 && !isThinking && !isStreamingReply

  useEffect(() => {
    if (isStarterState) return
    scrollToBottom()
  }, [messages, isThinking, isStreamingReply, isStarterState, scrollToBottom])

  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    setRevisionScope(loadStoredRevisionScope())
  }, [])

  useEffect(() => {
    storeRevisionScope(revisionScope)
    setRevisionScopeLoading(true)

    void fetchRevisionScopeContext(revisionScope)
      .then((data) => {
        setRevisionLessons(data.lessons)
        setRevisionContextBlock(data.contextBlock)
      })
      .catch(() => {
        setRevisionContextBlock("")
      })
      .finally(() => {
        setRevisionScopeLoading(false)
      })
  }, [revisionScope])

  useEffect(() => {
    const savedTier = window.localStorage.getItem("kael:student-tier")
    if (savedTier === "EXPLORER" || savedTier === "BUILDER" || savedTier === "PRO") {
      setStudentTier(savedTier)
    }

    const savedContext = window.localStorage.getItem("kael:recalled-context")
    if (savedContext) setRecalledContext(savedContext)
  }, [])

  useEffect(() => {
    const run = async () => {
      const response = await fetch("/api/auth/me").catch(() => null)
      if (!response?.ok) return

      const payload = (await response.json().catch(() => null)) as AuthMePayload | null
      const role = payload?.user?.role ?? "SU"
      const nextTier: KaelStudentTier =
        role === "SA" || role === "T" ? "PRO" : role === "S" ? "EXPLORER" : "BUILDER"

      setStudentTier(nextTier)
      window.localStorage.setItem("kael:student-tier", nextTier)
    }

    void run()
  }, [])

  useEffect(() => {
    const lessonId = activeDocument?.id
    if (!lessonId) return

    const run = async () => {
      const response = await fetch(`/api/lessons?id=${encodeURIComponent(lessonId)}`).catch(
        () => null
      )
      if (!response?.ok) return

      const payload = (await response.json().catch(() => null)) as LessonPayload | null
      const context = (payload?.lesson?.rawContext || payload?.lesson?.content || "").trim()
      if (!context) return

      setRecalledContext(context)
      window.localStorage.setItem("kael:recalled-context", context)
    }

    void run()
  }, [activeDocument?.id])

  const handleSend = async (value: string) => {
    const trimmed = value.trim()
    if (!trimmed || isThinking || isStreamingReply) return

    const baseId = messageIdRef.current
    messageIdRef.current += 2
    const assistantId = `kael-${baseId + 1}`

    const userMessage: ChatMessage = {
      id: `user-${baseId}`,
      role: "user",
      content: trimmed,
    }
    const history = [...messages, userMessage]

    setMessages(history)
    setInput("")
    setIsThinking(true)

    streamAbortRef.current?.abort()
    const controller = new AbortController()
    streamAbortRef.current = controller

    let started = false

    try {
      const mergedContext = [recalledContext.trim(), revisionContextBlock.trim()]
        .filter(Boolean)
        .join("\n\n")

      await streamKaelReply(
        history,
        {
          studentTier,
          recalledContext: mergedContext,
        },
        (text) => {
          if (!started) {
            started = true
            setIsThinking(false)
            setStreamingMessageId(assistantId)
            setMessages((prev) => [
              ...prev,
              { id: assistantId, role: "assistant", content: text },
            ])
            return
          }

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantId ? { ...message, content: text } : message
            )
          )
        },
        controller.signal
      )
    } catch (error) {
      if (controller.signal.aborted) return

      setIsThinking(false)
      setStreamingMessageId(null)
      setMessages((prev) => [
        ...prev,
        {
          id: assistantId,
          role: "assistant",
          content:
            error instanceof Error
              ? `**System error:** ${error.message}`
              : "**System error:** Kael could not respond.",
        },
      ])
      return
    } finally {
      if (streamAbortRef.current === controller) {
        streamAbortRef.current = null
      }
    }

    setStreamingMessageId(null)
  }

  return (
    <KaelShell className="flex h-dvh flex-col overflow-hidden">
      <motion.main
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.5 }}
        className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col"
      >
        {/* ── Top bar ── */}
        <motion.header
          initial={reduceMotion ? false : { y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...spring, delay: reduceMotion ? 0 : 0.05 }}
          className="flex shrink-0 items-center justify-between border-b border-[var(--kael-border)]/40 bg-[var(--kael-bg)]/80 px-4 py-3 backdrop-blur-md sm:px-5"
        >
          <Link href="/welcome" className="inline-flex items-center gap-2.5">
            <KaelLogo variant="mark" className="h-9 w-9" />
            <div>
              <p className="kael-heading text-sm font-bold leading-none">{AI_NAME}</p>
              <p className="mt-0.5 text-[10px] text-[var(--kael-muted)]">{KAEL_TAGLINE}</p>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-2 rounded-full border border-[var(--kael-border)]/60 bg-[var(--kael-surface)] px-3 py-1 text-[11px] text-[var(--kael-muted)] sm:inline-flex">
              <Sparkles className="h-3 w-3 text-[var(--kael-accent)]" />
              {COURSE_NAME}
            </span>

            <motion.div whileHover={reduceMotion ? undefined : { scale: 1.04 }} whileTap={reduceMotion ? undefined : { scale: 0.96 }}>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--kael-accent)] px-3 py-1.5 text-xs font-semibold text-[var(--kael-on-accent)] shadow-sm hover:opacity-90"
              >
                ReviseAI
                <ArrowRight className="h-3 w-3" />
              </Link>
            </motion.div>
          </div>
        </motion.header>

        {/* ── Chat shell ── */}
        <div className="relative flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ ...spring, delay: reduceMotion ? 0 : 0.12 }}
            className="relative flex min-h-0 flex-1 flex-col overflow-hidden kael-panel shadow-lg"
          >
            {/* Main view transition container */}
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <AnimatePresence mode="wait">
                {isStarterState ? (
                  <motion.div
                    key="welcome-dashboard"
                    initial={reduceMotion ? false : { opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -15 }}
                    transition={{ duration: 0.25 }}
                    className="flex flex-col items-center justify-center flex-1 py-8 px-4 text-center max-w-lg mx-auto space-y-6 overflow-y-auto kael-scrollbar"
                  >
                    <motion.div
                      className="h-16 w-16 relative shrink-0"
                      animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <KaelLogo variant="mark" className="h-full w-full filter drop-shadow-md" />
                    </motion.div>

                    <div className="space-y-2">
                      <h2 className="kael-heading text-2xl font-bold tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 bg-clip-text text-transparent dark:from-white dark:via-indigo-200 dark:to-white">
                        Meet {AI_NAME}
                      </h2>
                      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                        I am {AI_NAME}. Systems locked to **{COURSE_NAME}**. Provide your assignment brief, current code, and deadline.
                      </p>
                    </div>

                    <div className="w-full grid gap-2.5 sm:grid-cols-2 pt-2">
                      {STARTERS.map((starter, index) => (
                        <StarterChip
                          key={starter.prompt}
                          starter={starter}
                          index={index}
                          reduceMotion={reduceMotion}
                          spring={spring}
                          onSelect={handleSend}
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="chat-thread"
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col flex-1 min-h-0"
                  >
                    {/* Chat header */}
                    <div className="relative shrink-0 border-b border-[var(--kael-border)]/40 px-4 py-3 sm:px-5">
                      <div className="flex items-center gap-3">
                        <KaelAvatar reduceMotion={reduceMotion} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h1 className="kael-heading text-base font-semibold">{AI_NAME}</h1>
                            <span className="kael-status-online inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--kael-online)]" />
                              Online
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-medium">
                            {studentTier} mode ·{" "}
                            {revisionScope.mode === "all"
                              ? `curriculum-locked to ${COURSE_NAME}`
                              : describeRevisionScope(revisionScope, revisionLessons)}
                          </p>
                        </div>
                        <Zap className="h-4 w-4 text-indigo-500/70" />
                      </div>
                    </div>

                    {/* Messages */}
                    <div
                      ref={messagesContainerRef}
                      className="relative min-h-0 flex-1 overflow-y-auto px-4 sm:px-5 py-5 space-y-4 kael-scrollbar"
                    >
                      <div className="space-y-4">
                        <AnimatePresence mode="popLayout" initial={false}>
                          {messages.map((message) => (
                            <ChatBubble
                              key={message.id}
                              message={message}
                              isStreaming={message.id === streamingMessageId}
                              reduceMotion={reduceMotion}
                              spring={spring}
                            />
                          ))}
                        </AnimatePresence>

                        <AnimatePresence>
                          {isThinking ? <ThinkingBubble reduceMotion={reduceMotion} /> : null}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input bar */}
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring, delay: reduceMotion ? 0 : 0.25 }}
              className="relative shrink-0 bg-transparent px-4 py-4 sm:px-5 border-t border-[var(--kael-border)]/40 bg-[var(--kael-surface)]/20"
            >
              <KaelRevisionScopeStrip
                scope={revisionScope}
                lessons={revisionLessons}
                loading={revisionScopeLoading}
                onChange={setRevisionScope}
                className="mb-3.5"
              />

              <AnimatePresence>
                {!isStarterState ? (
                  <motion.div
                    key="chips"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-3.5 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
                  >
                    {STARTERS.map((starter, index) => (
                      <motion.button
                        key={starter.prompt}
                        type="button"
                        initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ ...spring, delay: reduceMotion ? 0 : index * 0.05 }}
                        whileHover={reduceMotion ? undefined : { y: -2, scale: 1.04 }}
                        whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                        onClick={() => handleSend(starter.prompt)}
                        disabled={isThinking || isStreamingReply}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 dark:hover:border-indigo-800 dark:hover:text-indigo-400"
                      >
                        <starter.icon className="h-3 w-3 text-indigo-500" />
                        {starter.title}
                      </motion.button>
                    ))}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  handleSend(input)
                }}
                className="relative flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white/95 p-1.5 shadow-sm transition-all focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 dark:border-slate-800/80 dark:bg-slate-950/95 dark:focus-within:border-indigo-500/40"
              >
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  disabled={isThinking || isStreamingReply}
                  placeholder={`State your assignment task…`}
                  aria-label={`Message ${AI_NAME}`}
                  className="h-10 flex-1 bg-transparent px-3 text-sm text-foreground placeholder:text-muted-foreground/75 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />

                <motion.button
                  type="submit"
                  disabled={!canSend}
                  whileHover={canSend && !reduceMotion ? { scale: 1.05 } : undefined}
                  whileTap={canSend && !reduceMotion ? { scale: 0.95 } : undefined}
                  animate={
                    canSend && !reduceMotion
                      ? {
                          boxShadow: [
                            "0 0 0 0 rgba(79, 70, 229, 0.4)",
                            "0 0 0 10px rgba(79, 70, 229, 0)",
                            "0 0 0 0 rgba(79, 70, 229, 0)",
                          ],
                        }
                      : undefined
                  }
                  transition={
                    canSend && !reduceMotion
                      ? { boxShadow: { duration: 2, repeat: Infinity } }
                      : undefined
                  }
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md transition-colors hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none dark:disabled:bg-slate-800 dark:disabled:text-slate-600"
                >
                  <motion.span
                    className="inline-flex items-center justify-center"
                    animate={canSend && !reduceMotion ? { rotate: [0, -12, 0] } : undefined}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <SendHorizonal className="h-4.5 w-4.5" />
                  </motion.span>
                </motion.button>
              </form>

              <motion.p
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.5 }}
                className="mt-2.5 text-center text-[10px] font-medium text-slate-400 dark:text-slate-500"
              >
                Enter to send · Responses follow Kael mode and T Level criteria
              </motion.p>
            </motion.div>
          </motion.div>
        </div>
      </motion.main>
    </KaelShell>
  )
}
