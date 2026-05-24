"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Activity, ArrowRight, BookOpen, ClipboardCheck, MessagesSquare } from "lucide-react"

import { cn } from "@/lib/utils"
import ActiveDraftsClient from "./ActiveDraftsClient"
import NoticeBoardAndFlashcards, {
  type GapItem,
  type SyncItem,
} from "./NoticeBoardAndFlashcards"

interface WeakArea {
  topic: string
  reason: string
  action: string
}

interface WeaknessPlan {
  summary: string
  weakAreas: WeakArea[]
  encouragement: string
}

interface Submission {
  id: string
  status: string
  score?: number
  createdAt: string
  question?: { title?: string }
}

interface DashboardClientProps {
  syncedCount: number
  totalQuestions: number
  attemptedCount: number
  averageScore: number | null
  syncsList: SyncItem[]
  subsList: Submission[]
  gapsList: GapItem[]
  scoreData: { topicTitle: string; avgScore: number }[]
  weaknessPlan: WeaknessPlan | null
  fallbackWeaknessPlan: WeaknessPlan
}

const EXAM_FACTS = [
  "Functional dependencies need a superkey on the left side for BCNF.",
  "ACID keeps transactions stable under failures and concurrency.",
  "3NF removes transitive dependencies to reduce update anomalies.",
  "CASCADE deletes dependents automatically while RESTRICT blocks delete.",
]

const COMMANDS = [
  { href: "/canvas", icon: Activity, label: "Topic Checklist" },
  { href: "/teams", icon: MessagesSquare, label: "Teams Updates" },
  { href: "/lessons", icon: BookOpen, label: "Lessons Chat" },
  { href: "/exam-prep", icon: ClipboardCheck, label: "Practice Exam" },
] as const

type CanvasMode = "roadmap" | "practice" | "history"

function levelTone(score: number) {
  if (score >= 80) return "text-emerald-500"
  if (score >= 60) return "text-amber-500"
  return "text-rose-500"
}

export default function DashboardClient({
  syncedCount,
  totalQuestions,
  attemptedCount,
  averageScore,
  syncsList,
  subsList,
  gapsList,
  scoreData,
  weaknessPlan,
  fallbackWeaknessPlan,
}: DashboardClientProps) {
  const [factIndex, setFactIndex] = useState(0)
  const [mode, setMode] = useState<CanvasMode>("roadmap")

  const activeScores = useMemo(
    () =>
      scoreData?.length
        ? scoreData
        : [
            { topicTitle: "Database Normalization", avgScore: 55 },
            { topicTitle: "ER Diagrams", avgScore: 62 },
            { topicTitle: "SQL Constraints", avgScore: 78 },
            { topicTitle: "Key Constraints", avgScore: 85 },
          ],
    [scoreData]
  )

  const [activeTopic, setActiveTopic] = useState(activeScores[0]?.topicTitle ?? "Database Normalization")
  const plan = weaknessPlan ?? fallbackWeaknessPlan
  const readinessPercent = totalQuestions > 0 ? Math.round((attemptedCount / totalQuestions) * 100) : 0

  useEffect(() => {
    const timer = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % EXAM_FACTS.length)
    }, 5500)
    return () => clearInterval(timer)
  }, [])

  const activeNote =
    plan.weakAreas.find((area) =>
      area.topic.toLowerCase().includes(activeTopic.toLowerCase())
    ) ?? plan.weakAreas[0]

  const recentSubs = subsList.slice(0, 6)

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)]">
      <main className="space-y-5">
        <section className="zenith-surface px-5 py-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
                Revision Workspace
              </p>
              <h1 className="mt-1 text-2xl font-heading text-foreground">
                Curriculum Journey
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Hover or select any topic to update the AI rail instantly.
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold text-foreground">
                Mastery Score{" "}
                <span className={cn(averageScore ? levelTone(averageScore) : "text-muted-foreground")}>
                  {averageScore !== null ? `${averageScore}%` : "Not graded"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Exam readiness {readinessPercent}%
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-border/50 pt-3">
            <p className="text-sm text-primary/90">
              AI Note: {EXAM_FACTS[factIndex]}
            </p>
          </div>
        </section>

        <section className="zenith-surface px-2 py-2">
          <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-3 pb-3">
            {(["roadmap", "practice", "history"] as CanvasMode[]).map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setMode(candidate)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors",
                  mode === candidate
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
                )}
              >
                {candidate}
              </button>
            ))}
            <div className="ml-auto flex flex-wrap gap-2">
              {COMMANDS.map((command) => (
                <Link
                  key={command.href}
                  href={command.href}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/60"
                >
                  <command.icon className="h-3.5 w-3.5" />
                  {command.label}
                </Link>
              ))}
            </div>
          </div>

          {mode === "roadmap" && (
            <div className="px-3 py-2">
              {activeScores.map((topic) => (
                <button
                  key={topic.topicTitle}
                  type="button"
                  onMouseEnter={() => setActiveTopic(topic.topicTitle)}
                  onFocus={() => setActiveTopic(topic.topicTitle)}
                  onClick={() => setActiveTopic(topic.topicTitle)}
                  className={cn(
                    "group w-full border-b border-border/45 py-3 text-left last:border-b-0",
                    activeTopic === topic.topicTitle && "bg-accent/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{topic.topicTitle}</span>
                    <span className={cn("text-sm font-semibold", levelTone(topic.avgScore))}>
                      {topic.avgScore}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {topic.avgScore < 60
                      ? "Needs immediate reinforcement."
                      : topic.avgScore < 80
                      ? "Progressing, continue practice."
                      : "On track, maintain cadence."}
                  </p>
                  {activeTopic === topic.topicTitle && activeNote ? (
                    <p className="mt-2 text-xs text-primary/90 border-l border-primary/40 pl-3">
                      AI Note: {activeNote.reason}
                    </p>
                  ) : null}
                </button>
              ))}
            </div>
          )}

          {mode === "practice" && (
            <div className="px-3 py-2 space-y-3">
              {gapsList.slice(0, 5).map((gap) => (
                <div key={gap.id} className="border-b border-border/45 pb-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{gap.key}</p>
                    <span className={cn("text-xs font-semibold", levelTone(gap.masteryScore))}>
                      {gap.masteryScore}%
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{gap.summary}</p>
                </div>
              ))}
              <Link href="/revision" className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
                Start focused revision <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}

          {mode === "history" && (
            <div className="px-3 py-2 space-y-3">
              {recentSubs.length ? (
                recentSubs.map((sub) => (
                  <div key={sub.id} className="border-b border-border/45 pb-3 last:border-b-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {sub.question?.title || "Revision Assignment"}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(sub.createdAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {sub.status === "marked" ? `Scored ${sub.score ?? 0}%` : sub.status}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No submissions yet.</p>
              )}
            </div>
          )}
        </section>

        <section className="zenith-surface px-4 py-4">
          <div className="flex items-center justify-between border-b border-border/50 pb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Continue Drafts
            </h2>
            <Link href="/lessons" className="text-xs font-semibold text-primary">
              Open lessons
            </Link>
          </div>
          <div className="pt-4">
            <ActiveDraftsClient />
          </div>
        </section>
      </main>

      <aside className="space-y-4 xl:sticky xl:top-20 self-start">
        <section className="zenith-surface px-4 py-4">
          <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">
            Context Rail
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <p className="text-foreground font-medium">{activeTopic}</p>
            <p className="text-muted-foreground">{activeNote?.action ?? plan.summary}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-border/50 pt-3 text-xs">
            <div>
              <p className="text-muted-foreground">Sync updates</p>
              <p className="font-semibold text-foreground">{syncedCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Questions</p>
              <p className="font-semibold text-foreground">{totalQuestions}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Attempted</p>
              <p className="font-semibold text-foreground">{attemptedCount}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Gaps</p>
              <p className="font-semibold text-foreground">{gapsList.length}</p>
            </div>
          </div>
        </section>

        <NoticeBoardAndFlashcards
          key={activeTopic}
          activeTopic={activeTopic}
          syncsList={syncsList}
          gapsList={gapsList}
        />
      </aside>
    </div>
  )
}
