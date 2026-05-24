"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { buildRevisionScopeFetchUrl } from "@/components/revision/RevisionScopeFilters"
import { parseRevisionScope } from "@/lib/revision/revision-scope"

export function RevisionPathlineLink() {
  const searchParams = useSearchParams()
  const href = buildRevisionScopeFetchUrl(
    "/revision/pathline",
    parseRevisionScope(searchParams)
  )

  return (
    <Link
      href={href}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-5 text-xs font-bold text-primary-foreground transition-all hover:opacity-90 hover-lift active-press"
    >
      Open Pathline
      <ChevronRight className="h-3.5 w-3.5" />
    </Link>
  )
}
