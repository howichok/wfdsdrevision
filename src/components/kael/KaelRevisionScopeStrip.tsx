"use client"

import { useEffect, useState } from "react"
import { BookOpen, CalendarDays, CalendarRange, Filter } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import {
  buildRevisionScopeFetchUrl,
} from "@/components/revision/RevisionScopeFilters"
import {
  DEFAULT_REVISION_SCOPE,
  describeRevisionScope,
  formatRevisionLessonDate,
  type RevisionLessonOption,
  type RevisionScope,
  type RevisionScopeMode,
} from "@/lib/revision/revision-scope"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "kael:revision-scope"

const MODES: {
  value: RevisionScopeMode
  label: string
  icon: typeof Filter
}[] = [
  { value: "all", label: "All", icon: Filter },
  { value: "lesson", label: "Lesson", icon: BookOpen },
  { value: "date", label: "Date", icon: CalendarDays },
  { value: "range", label: "Range", icon: CalendarRange },
]

interface KaelRevisionScopeStripProps {
  scope: RevisionScope
  lessons: RevisionLessonOption[]
  loading?: boolean
  onChange: (scope: RevisionScope) => void
  className?: string
}

export function KaelRevisionScopeStrip({
  scope,
  lessons,
  loading = false,
  onChange,
  className,
}: KaelRevisionScopeStripProps) {
  const [expanded, setExpanded] = useState(scope.mode !== "all")

  useEffect(() => {
    setExpanded(scope.mode !== "all")
  }, [scope.mode])

  const setMode = (mode: RevisionScopeMode) => {
    if (mode === "all") {
      onChange(DEFAULT_REVISION_SCOPE)
      setExpanded(false)
      return
    }

    setExpanded(true)

    if (mode === "lesson") {
      onChange({ mode, lessonId: lessons[0]?.id })
      return
    }

    if (mode === "date") {
      onChange({ mode, date: new Date().toISOString().slice(0, 10) })
      return
    }

    const today = new Date()
    const weekAgo = new Date(today)
    weekAgo.setDate(today.getDate() - 7)

    onChange({
      mode: "range",
      dateFrom: weekAgo.toISOString().slice(0, 10),
      dateTo: today.toISOString().slice(0, 10),
    })
  }

  // ── Helper presets for Date & Range modes ──
  const getDaysAgo = (num: number) => {
    const d = new Date()
    d.setDate(d.getDate() - num)
    return d.toISOString().slice(0, 10)
  }
  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = getDaysAgo(1)

  // Lesson presets
  const recentLessons = lessons.slice(0, 3)

  // Single date states
  const isToday = scope.date === todayStr
  const isYesterday = scope.date === yesterdayStr
  const isCustomDate = scope.mode === "date" && !isToday && !isYesterday

  // Date range states
  const isLast7 = scope.mode === "range" && scope.dateFrom === getDaysAgo(7) && scope.dateTo === todayStr
  const isLast14 = scope.mode === "range" && scope.dateFrom === getDaysAgo(14) && scope.dateTo === todayStr
  const isLast30 = scope.mode === "range" && scope.dateFrom === getDaysAgo(30) && scope.dateTo === todayStr
  const isCustomRange = scope.mode === "range" && !isLast7 && !isLast14 && !isLast30

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {MODES.map((mode) => {
          const Icon = mode.icon
          const active = scope.mode === mode.value
          return (
            <button
              key={mode.value}
              type="button"
              data-active={active ? "true" : "false"}
              onClick={() => setMode(mode.value)}
              className="kael-chip inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-all duration-200 hover:text-[var(--kael-ink)]"
            >
              <Icon className="h-3 w-3 text-[var(--kael-accent)]" />
              {mode.label}
            </button>
          )
        })}
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            initial={{ height: 0, opacity: 0, marginTop: 0 }}
            animate={{ height: "auto", opacity: 1, marginTop: 8 }}
            exit={{ height: 0, opacity: 0, marginTop: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="rounded-2xl border border-slate-200/50 bg-slate-50/50 p-3.5 dark:border-slate-800/40 dark:bg-slate-900/30">
              
              {/* ── LESSON MODE ── */}
              {scope.mode === "lesson" ? (
                <div className="space-y-3">
                  {recentLessons.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">Quick Select Recent Lessons</span>
                      <div className="flex flex-wrap gap-2">
                        {recentLessons.map((lesson) => {
                          const isActive = scope.lessonId === lesson.id
                          return (
                            <button
                              key={lesson.id}
                              type="button"
                              onClick={() => onChange({ mode: "lesson", lessonId: lesson.id })}
                              className={cn(
                                "px-3 py-1.5 rounded-xl text-xs font-semibold border text-left truncate max-w-[200px] transition-all",
                                isActive
                                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                                  : "bg-white/80 border-slate-200 text-slate-700 hover:border-indigo-300 dark:bg-slate-950/80 dark:border-slate-800 dark:text-slate-350 dark:hover:border-indigo-800"
                              )}
                            >
                              {lesson.title}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] uppercase font-bold tracking-wider text-slate-400 dark:text-slate-500">All Synced Lessons</span>
                    <select
                      value={scope.lessonId ?? ""}
                      onChange={(event) =>
                        onChange({ mode: "lesson", lessonId: event.target.value })
                      }
                      className="h-9 w-full rounded-full border border-slate-200 bg-white/95 px-4 text-xs text-slate-850 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-200 dark:focus:border-indigo-500/40"
                    >
                      {lessons.length === 0 ? (
                        <option value="">No lessons synced yet</option>
                      ) : (
                        lessons.map((lesson) => (
                          <option key={lesson.id} value={lesson.id} className="dark:bg-slate-950">
                            {lesson.title}
                            {lesson.date ? ` · ${formatRevisionLessonDate(lesson.date)}` : ""}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              ) : null}

              {/* ── DATE MODE ── */}
              {scope.mode === "date" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onChange({ mode: "date", date: todayStr })}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        isToday
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-white/80 border-slate-200 text-slate-650 dark:bg-slate-950/80 dark:border-slate-800 dark:text-slate-400"
                      )}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ mode: "date", date: yesterdayStr })}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        isYesterday
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-white/80 border-slate-200 text-slate-650 dark:bg-slate-950/80 dark:border-slate-800 dark:text-slate-400"
                      )}
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!scope.date) {
                          onChange({ mode: "date", date: todayStr })
                        } else if (isToday || isYesterday) {
                          onChange({ mode: "date", date: getDaysAgo(2) })
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        isCustomDate
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-white/80 border-slate-200 text-slate-650 dark:bg-slate-950/80 dark:border-slate-800 dark:text-slate-400"
                      )}
                    >
                      Custom Date
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {isCustomDate ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <input
                          type="date"
                          value={scope.date ?? ""}
                          onChange={(event) => onChange({ mode: "date", date: event.target.value })}
                          className="h-9 w-full rounded-full border border-slate-200 bg-white/95 px-4 text-xs text-slate-850 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-200 dark:focus:border-indigo-500/40"
                        />
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : null}

              {/* ── RANGE MODE ── */}
              {scope.mode === "range" ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onChange({ mode: "range", dateFrom: getDaysAgo(7), dateTo: todayStr })}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        isLast7
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-white/80 border-slate-200 text-slate-650 dark:bg-slate-950/80 dark:border-slate-800 dark:text-slate-400"
                      )}
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ mode: "range", dateFrom: getDaysAgo(14), dateTo: todayStr })}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        isLast14
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-white/80 border-slate-200 text-slate-650 dark:bg-slate-950/80 dark:border-slate-800 dark:text-slate-400"
                      )}
                    >
                      Last 2 Weeks
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange({ mode: "range", dateFrom: getDaysAgo(30), dateTo: todayStr })}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        isLast30
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-white/80 border-slate-200 text-slate-650 dark:bg-slate-950/80 dark:border-slate-800 dark:text-slate-400"
                      )}
                    >
                      This Month
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!scope.dateFrom || !scope.dateTo) {
                          onChange({ mode: "range", dateFrom: getDaysAgo(7), dateTo: todayStr })
                        } else if (isLast7 || isLast14 || isLast30) {
                          // Change slightly to break preset triggers
                          onChange({ mode: "range", dateFrom: getDaysAgo(8), dateTo: todayStr })
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-xs font-semibold border transition-all",
                        isCustomRange
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-sm"
                          : "bg-white/80 border-slate-200 text-slate-650 dark:bg-slate-950/80 dark:border-slate-800 dark:text-slate-400"
                      )}
                    >
                      Custom Range
                    </button>
                  </div>

                  <AnimatePresence initial={false}>
                    {isCustomRange ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex-1 relative">
                            <span className="absolute left-4 top-2.5 text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 pointer-events-none">From</span>
                            <input
                              type="date"
                              value={scope.dateFrom ?? ""}
                              onChange={(event) =>
                                onChange({
                                  mode: "range",
                                  dateFrom: event.target.value,
                                  dateTo: scope.dateTo,
                                })
                              }
                              className="h-10 w-full rounded-full border border-slate-200 bg-white/95 pl-14 pr-4 text-xs text-slate-850 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-200 dark:focus:border-indigo-500/40"
                              aria-label="Revision from date"
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-400">to</span>
                          <div className="flex-1 relative">
                            <span className="absolute left-4 top-2.5 text-[9px] uppercase font-bold text-slate-400 dark:text-slate-500 pointer-events-none">To</span>
                            <input
                              type="date"
                              value={scope.dateTo ?? ""}
                              onChange={(event) =>
                                onChange({
                                  mode: "range",
                                  dateFrom: scope.dateFrom,
                                  dateTo: event.target.value,
                                })
                              }
                              className="h-10 w-full rounded-full border border-slate-200 bg-white/95 pl-14 pr-4 text-xs text-slate-850 shadow-sm outline-none transition-all focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-200 dark:focus:border-indigo-500/40"
                              aria-label="Revision to date"
                            />
                          </div>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              ) : null}

              <p className="mt-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {loading ? "Updating revision context…" : describeRevisionScope(scope, lessons)}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export function loadStoredRevisionScope(): RevisionScope {
  if (typeof window === "undefined") return DEFAULT_REVISION_SCOPE

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_REVISION_SCOPE
    const parsed = JSON.parse(raw) as RevisionScope
    if (!parsed?.mode) return DEFAULT_REVISION_SCOPE
    return parsed
  } catch {
    return DEFAULT_REVISION_SCOPE
  }
}

export function storeRevisionScope(scope: RevisionScope) {
  if (typeof window === "undefined") return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(scope))
}

export function fetchRevisionScopeContext(scope: RevisionScope) {
  return fetch(buildRevisionScopeFetchUrl("/api/ai/kael/revision-scope", scope))
    .then(async (response) => {
      if (!response.ok) throw new Error("Failed to load revision scope")
      return response.json() as Promise<{
        lessons: RevisionLessonOption[]
        contextBlock: string
      }>
    })
}
