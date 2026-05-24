"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useAppSession } from "@/lib/auth/auth-client";
import { cn } from "@/lib/utils";
import {
  buildRevisionScopeFetchUrl,
  RevisionScopeFilters,
} from "@/components/revision/RevisionScopeFilters";
import {
  parseRevisionScope,
  revisionScopeQueryString,
  type RevisionLessonOption,
  type RevisionScope,
} from "@/lib/revision/revision-scope";
import {
  BookOpen,
  Atom,
  Leaf,
  Globe,
  Database,
  Code2,
  GraduationCap,
  Layers,
  Loader2,
  ChevronRight,
} from "lucide-react";
import type { PathlineData, PathlineNode } from "@/lib/revision/pathline-data";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  book: BookOpen,
  atom: Atom,
  leaf: Leaf,
  globe: Globe,
  database: Database,
  code: Code2,
  graduation: GraduationCap,
  layers: Layers,
};

function NodeIcon({ iconKey, className }: { iconKey: string; className?: string }) {
  const Icon = ICON_MAP[iconKey] ?? Layers;
  return <Icon className={className} />;
}

function PathNode({ node, isLast }: { node: PathlineNode; isLast: boolean }) {
  const isCompleted = node.status === "completed";
  const isActive = node.status === "active";
  const isLocked = node.status === "locked";

  return (
    <div className="flex items-start flex-1 min-w-0">
      <div className="relative flex flex-col items-center">
        <Link
          href={isLocked ? "#" : node.href}
          onClick={(e) => isLocked && e.preventDefault()}
          className={cn(
            "relative z-10 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border-2 transition-all duration-300",
            isCompleted &&
              "border-emerald-400 bg-emerald-500/90 text-white shadow-[0_0_24px_rgba(52,211,153,0.45)]",
            isActive &&
              "border-teal-300 bg-teal-500/20 text-teal-200 shadow-[0_0_32px_rgba(45,212,191,0.55)] ring-4 ring-teal-400/30",
            isLocked && "border-zinc-600 bg-zinc-800/60 text-zinc-500 cursor-not-allowed"
          )}
        >
          {isActive && (
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 72 72">
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="none"
                stroke="rgba(45,212,191,0.25)"
                strokeWidth="3"
              />
              <circle
                cx="36"
                cy="36"
                r="32"
                fill="none"
                stroke="rgb(45,212,191)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={`${(node.progress / 100) * 201} 201`}
              />
            </svg>
          )}
          <NodeIcon iconKey={node.iconKey} className="h-7 w-7 relative z-10" />
        </Link>
        <div className="mt-4 text-center max-w-[7rem]">
          <p
            className={cn(
              "text-xs font-semibold leading-tight",
              isLocked ? "text-zinc-500" : "text-zinc-100"
            )}
          >
            {node.title}
          </p>
          <p
            className={cn(
              "text-[11px] font-bold mt-1 tabular-nums",
              isCompleted && "text-emerald-400",
              isActive && "text-teal-300",
              isLocked && "text-zinc-600"
            )}
          >
            {node.progress}%
          </p>
        </div>
      </div>
      {!isLast && (
        <div
          className={cn(
            "h-0.5 flex-1 mt-9 mx-1 min-w-[1.5rem] rounded-full",
            isCompleted ? "bg-emerald-500/70" : "bg-zinc-700"
          )}
        />
      )}
    </div>
  );
}

export function RevisionPathlineView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useAppSession();
  const initialScope = useMemo(
    () => parseRevisionScope(searchParams),
    [searchParams]
  );
  const [scope, setScope] = useState<RevisionScope>(initialScope);

  useEffect(() => {
    setScope(parseRevisionScope(searchParams));
  }, [searchParams]);

  const updateScope = useCallback(
    (nextScope: RevisionScope) => {
      setScope(nextScope);
      const query = revisionScopeQueryString(nextScope);
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router]
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["revision-pathline", scope],
    queryFn: async () => {
      const res = await fetch(buildRevisionScopeFetchUrl("/api/revision/pathline", scope));
      if (!res.ok) throw new Error("Failed to load path");
      return res.json() as Promise<PathlineData>;
    },
    staleTime: 30_000,
  });

  const { data: hubData } = useQuery({
    queryKey: ["revision-hub-lessons", scope.mode],
    queryFn: async () => {
      const res = await fetch("/api/revision/hub");
      if (!res.ok) throw new Error("Failed to load lessons");
      return res.json() as Promise<{ lessons: RevisionLessonOption[] }>;
    },
    staleTime: 60_000,
  });

  const lessons = hubData?.lessons ?? [];

  const now = new Date();
  const timeLabel = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const initial = (session?.user?.name ?? session?.user?.email ?? "U").charAt(0).toUpperCase();

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl bg-[#141414] text-zinc-400 gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-teal-400" />
        Loading your revision path…
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-3xl bg-[#141414] border border-zinc-800 p-12 text-center text-zinc-400">
        Could not load pathline data.
      </div>
    );
  }

  const activeNode = data.nodes.find((n) => n.status === "active");

  return (
    <div className="space-y-4">
      <RevisionScopeFilters
        scope={scope}
        lessons={lessons}
        onChange={updateScope}
        className="border-zinc-800 bg-zinc-900/60 text-zinc-100"
      />

      <div className="rounded-3xl overflow-hidden border border-zinc-800/80 bg-[#121212] shadow-2xl">
      <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/80 bg-[#0f0f0f]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/20 border border-teal-500/40">
            <BookOpen className="h-5 w-5 text-teal-400" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-[0.2em] text-zinc-100 uppercase">
              {data.brandTitle}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{data.specificationSource}</p>
          </div>
        </div>

        <div className="flex items-center gap-6 text-xs text-zinc-400">
          <div className="hidden sm:flex items-center gap-4">
            <span>
              Goals{" "}
              <strong className="text-teal-400">
                {data.goalsCompleted}/{data.goalsTotal}
              </strong>
            </span>
            <span>
              Streaks{" "}
              <strong className="text-emerald-400">{data.streakDays}/1</strong>
            </span>
          </div>
          <span className="tabular-nums text-zinc-300">{timeLabel}</span>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 border border-zinc-700 text-sm font-bold text-zinc-200">
            {initial}.
          </div>
        </div>
      </div>

      <div className="px-6 sm:px-10 py-14 sm:py-16 overflow-x-auto">
        <div className="flex items-start min-w-[640px] max-w-5xl mx-auto">
          {data.nodes.map((node, i) => (
            <PathNode key={node.id} node={node} isLast={i === data.nodes.length - 1} />
          ))}
        </div>
      </div>

      {activeNode && (
        <div className="mx-6 sm:mx-8 mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-teal-500 font-bold">
                Current chapter
              </p>
              <h2 className="text-lg font-bold text-zinc-50 mt-1">{activeNode.title}</h2>
              <p className="text-sm text-zinc-400 mt-1">{activeNode.subtitle}</p>
              {activeNode.concepts && activeNode.concepts.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {activeNode.concepts.slice(0, 4).map((c) => (
                    <li
                      key={c}
                      className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-[10px] text-zinc-300"
                    >
                      {c.length > 40 ? `${c.slice(0, 38)}…` : c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {activeNode.status !== "locked" && (
              <Link
                href={activeNode.href}
                className="inline-flex items-center gap-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-zinc-950 px-5 py-2.5 text-sm font-bold transition-colors shrink-0"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
      )}

      <p className="text-center text-[10px] text-zinc-600 pb-6 px-4">
        Chapters from {data.subject} lessons & specification · Progress from recall, challenges &
        revision
      </p>
      </div>
    </div>
  );
}
