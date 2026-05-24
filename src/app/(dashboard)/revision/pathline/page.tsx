import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth/permissions";
import { RevisionPathlineView } from "@/components/revision/RevisionPathlineView";

export const dynamic = "force-dynamic";

function PathlineFallback() {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-8 text-sm text-muted-foreground">
      Loading pathline scope…
    </div>
  );
}

export default async function RevisionPathlinePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/revision"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Revision Pathline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your syllabus journey — filter by lesson, date, or date range.
          </p>
        </div>
      </div>

      <Suspense fallback={<PathlineFallback />}>
        <RevisionPathlineView />
      </Suspense>
    </div>
  );
}
