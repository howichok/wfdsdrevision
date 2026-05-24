"use client"

import { CalendarDays, Filter } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DEFAULT_REVISION_SCOPE,
  describeRevisionScope,
  formatRevisionLessonDate,
  revisionScopeQueryString,
  type RevisionLessonOption,
  type RevisionScope,
  type RevisionScopeMode,
} from "@/lib/revision/revision-scope"

const SCOPE_MODES: { value: RevisionScopeMode; label: string }[] = [
  { value: "all", label: "All" },
  { value: "lesson", label: "Lesson" },
  { value: "date", label: "Date" },
  { value: "range", label: "Range" },
]

interface RevisionScopeFiltersProps {
  scope: RevisionScope
  lessons: RevisionLessonOption[]
  onChange: (scope: RevisionScope) => void
  className?: string
  compact?: boolean
}

export function RevisionScopeFilters({
  scope,
  lessons,
  onChange,
  className,
  compact = false,
}: RevisionScopeFiltersProps) {
  const setMode = (mode: RevisionScopeMode) => {
    if (mode === "all") {
      onChange(DEFAULT_REVISION_SCOPE)
      return
    }

    if (mode === "lesson") {
      onChange({
        mode,
        lessonId: lessons[0]?.id,
      })
      return
    }

    if (mode === "date") {
      onChange({
        mode,
        date: new Date().toISOString().slice(0, 10),
      })
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

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3.5 w-3.5" />
          Revision scope
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SCOPE_MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                scope.mode === option.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {scope.mode === "lesson" ? (
        <div className={cn("mt-3", compact ? "max-w-xl" : "max-w-2xl")}>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Choose lesson
          </label>
          <select
            value={scope.lessonId ?? ""}
            onChange={(event) =>
              onChange({ mode: "lesson", lessonId: event.target.value })
            }
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          >
            {lessons.length === 0 ? (
              <option value="">No lessons available</option>
            ) : (
              lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                  {lesson.date ? ` · ${formatRevisionLessonDate(lesson.date)}` : ""}
                </option>
              ))
            )}
          </select>
        </div>
      ) : null}

      {scope.mode === "date" ? (
        <div className={cn("mt-3", compact ? "max-w-xs" : "max-w-sm")}>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Choose date
          </label>
          <input
            type="date"
            value={scope.date ?? ""}
            onChange={(event) => onChange({ mode: "date", date: event.target.value })}
            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
          />
        </div>
      ) : null}

      {scope.mode === "range" ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              From
            </label>
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
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              To
            </label>
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
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
          </div>
        </div>
      ) : null}

      <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <CalendarDays className="h-3.5 w-3.5 shrink-0" />
        {describeRevisionScope(scope, lessons)}
      </p>
    </div>
  )
}

export function buildRevisionScopeFetchUrl(
  basePath: string,
  scope: RevisionScope
): string {
  return `${basePath}${revisionScopeQueryString(scope)}`
}
