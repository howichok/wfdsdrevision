import { Suspense } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { RevisionHubClient } from "@/components/revision/RevisionHubClient"
import { RevisionPathlineLink } from "@/components/revision/RevisionPathlineLink"

export const dynamic = "force-dynamic"

function RevisionHubFallback() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-sm text-muted-foreground">
      Loading revision scope…
    </div>
  )
}

export default function RevisionHubPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight">Revision Hub</h1>
        <p className="text-sm text-muted-foreground">
          Choose a lesson, date, or date range, then open practice topics and receive
          AI grading against T Level criteria.
        </p>
      </div>

      <div className="zenith-card flex flex-col items-start justify-between gap-4 bg-[#12151c] p-5 text-zinc-100 border-zinc-800 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 font-heading text-sm font-bold">
            <span className="flex h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_var(--primary)]" />
            Revision Pathline
          </h2>
          <p className="mt-1 text-xs text-zinc-400">
            Visual syllabus journey — scoped to your selected lesson or dates.
          </p>
        </div>
        <Suspense
          fallback={
            <span className="inline-flex h-9 shrink-0 items-center rounded-xl bg-primary/60 px-5 text-xs font-bold text-primary-foreground">
              Open Pathline
            </span>
          }
        >
          <RevisionPathlineLink />
        </Suspense>
      </div>

      <div className="zenith-card flex flex-col items-start justify-between gap-4 border-primary/20 bg-primary/5 p-5 sm:flex-row sm:items-center">
        <h2 className="flex items-center gap-2 font-heading text-sm font-bold text-foreground">
          <span className="flex h-2.5 w-2.5 rounded-full bg-primary" />
          Personalized Error Matching Game
        </h2>
        <Link
          href="/revision/review"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground transition-all hover:opacity-90 hover-lift active-press"
        >
          Start Review Game
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <Suspense fallback={<RevisionHubFallback />}>
        <RevisionHubClient />
      </Suspense>
    </div>
  )
}
