"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { ChevronRight, Loader2 } from "lucide-react"
import {
  buildRevisionScopeFetchUrl,
  RevisionScopeFilters,
} from "@/components/revision/RevisionScopeFilters"
import type { RevisionHubData } from "@/lib/revision/hub-data"
import {
  parseRevisionScope,
  revisionScopeQueryString,
  type RevisionScope,
} from "@/lib/revision/revision-scope"
import { cn } from "@/lib/utils"

function scopeFromSearchParams(searchParams: URLSearchParams): RevisionScope {
  return parseRevisionScope(searchParams)
}

export function RevisionHubClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const initialScope = useMemo(
    () => scopeFromSearchParams(searchParams),
    [searchParams]
  )
  const [scope, setScope] = useState<RevisionScope>(initialScope)

  useEffect(() => {
    setScope(scopeFromSearchParams(searchParams))
  }, [searchParams])

  const updateScope = useCallback(
    (nextScope: RevisionScope) => {
      setScope(nextScope)
      const query = revisionScopeQueryString(nextScope)
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    },
    [pathname, router]
  )

  const { data, isLoading, isError } = useQuery({
    queryKey: ["revision-hub", scope],
    queryFn: async () => {
      const response = await fetch(buildRevisionScopeFetchUrl("/api/revision/hub", scope))
      if (!response.ok) throw new Error("Failed to load revision topics")
      return response.json() as Promise<RevisionHubData>
    },
    staleTime: 20_000,
  })

  const lessons = data?.lessons ?? []
  const topics = data?.topics ?? []
  const pathlineHref = buildRevisionScopeFetchUrl("/revision/pathline", scope)

  return (
    <div className="space-y-4">
      <RevisionScopeFilters scope={scope} lessons={lessons} onChange={updateScope} />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {isLoading
            ? "Loading topics…"
            : `${topics.length} topic${topics.length === 1 ? "" : "s"} in this scope`}
        </p>
        <Link
          href={pathlineHref}
          className="text-xs font-semibold text-primary hover:underline"
        >
          View scoped pathline
        </Link>
      </div>

      {isLoading ? (
        <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-border/60 bg-card/40 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading revision topics…
        </div>
      ) : isError ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          Could not load revision topics for this scope.
        </div>
      ) : topics.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-8 text-center">
          <p className="text-sm font-medium text-foreground">No topics in this scope</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try a different lesson, date, or date range — or import a lesson into the
            Revision Hub.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {topics.map((topic) => (
            <div
              key={topic.id}
              className="zenith-card-hover flex items-center justify-between p-5"
            >
              <div className="min-w-0 space-y-1 pr-3">
                <h3 className="font-heading text-sm font-bold text-foreground">
                  {topic.title}
                </h3>
                <p className="line-clamp-1 text-xs text-muted-foreground">
                  {topic.description}
                </p>
                <div className="flex flex-wrap gap-2 pt-1 text-[10px] text-muted-foreground">
                  <span>{topic.questionCount} questions</span>
                  {topic.linkedLessonTitle ? (
                    <span className="rounded-full bg-accent px-2 py-0.5 text-accent-foreground">
                      {topic.linkedLessonTitle}
                    </span>
                  ) : null}
                  {topic.averageScore !== null ? (
                    <span>Avg {topic.averageScore}%</span>
                  ) : null}
                </div>
              </div>
              <Link
                href={`/revision/${topic.id}`}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground transition-all hover:opacity-90 hover-lift active-press"
                )}
              >
                Open
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
