import ErrorMatchingGame from "@/components/review/ErrorMatchingGame";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default function ReviewPage() {
  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div>
        <Link
          href="/revision"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Revision Hub
        </Link>
      </div>

      {/* Main Board */}
      <div className="rounded-lg border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
        <ErrorMatchingGame />
      </div>
    </div>
  );
}
