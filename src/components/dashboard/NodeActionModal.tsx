"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, BookOpen, Zap, Brain } from "lucide-react";
import { CopilotSidebar } from "@/components/editor/CopilotSidebar";
import type { GraphNode } from "./KnowledgeCanvas";

interface NodeActionModalProps {
  node: GraphNode | null;
  onClose: () => void;
}

function masteryMeta(score: number) {
  if (score >= 85)
    return {
      label: "Mastered",
      color: "text-emerald-400",
      badge: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
      bar: "bg-emerald-500",
    };
  if (score >= 50)
    return {
      label: "Progressing",
      color: "text-indigo-400",
      badge: "bg-indigo-500/10 border-indigo-500/25 text-indigo-400",
      bar: "bg-indigo-500",
    };
  return {
    label: "Critical Gap",
    color: "text-amber-400",
    badge: "bg-amber-500/10 border-amber-500/25 text-amber-400",
    bar: "bg-amber-500",
  };
}

export function NodeActionModal({ node, onClose }: NodeActionModalProps) {
  const router = useRouter();
  const [showTutor, setShowTutor] = useState(false);

  const isOpen = node !== null;

  // Reset tutor panel whenever the selected node changes
  const meta = node ? masteryMeta(node.masteryScore) : null;

  return (
    <>
      {/* Scrim */}
      <div
        aria-hidden
        className={`fixed inset-0 z-40 bg-slate-950/55 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Slide-in drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={node?.key ?? "Node detail"}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-slate-950/95 backdrop-blur-xl shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {node && meta && (
          <>
            {/* ── Header ── */}
            <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div className="min-w-0 space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest ${meta.badge}`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[9px] font-medium uppercase tracking-wider text-slate-500">
                    {node.nodeType.replace(/_/g, " ")}
                  </span>
                </div>
                <h2 className="break-words text-sm font-bold leading-snug text-white">
                  {node.key}
                </h2>
                {node.lessonTitle && (
                  <p className="truncate text-[11px] text-slate-500">{node.lessonTitle}</p>
                )}
              </div>

              <button
                onClick={onClose}
                className="mt-0.5 shrink-0 cursor-pointer rounded-full p-1.5 text-slate-400 transition-all hover:bg-white/10 hover:text-white hover-lift active-press"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* ── Scrollable body ── */}
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              {/* Concept summary */}
              <div className="space-y-2 rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <BookOpen className="h-3 w-3" />
                  Concept Summary
                </div>
                <p className="text-xs leading-relaxed text-slate-300">{node.summary}</p>
              </div>

              {/* Mastery progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Mastery Score
                  </span>
                  <span className={`text-xs font-bold tabular-nums ${meta.color}`}>
                    {node.masteryScore}%
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${meta.bar}`}
                    style={{ width: `${node.masteryScore}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-600">
                  <span>0</span>
                  <span>50</span>
                  <span>85</span>
                  <span>100</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() =>
                    router.push(`/lessons/${node.lessonId}?reviewNode=${node.id}`)
                  }
                  className="group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-600/10 p-4 text-center hover-lift active-press transition-all duration-200 hover:bg-indigo-600/20"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 transition-transform group-hover:scale-110">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-indigo-300">Launch Quick Review</p>
                    <p className="mt-0.5 text-[9px] text-slate-500">Parson's code sort</p>
                  </div>
                </button>

                <button
                  onClick={() => setShowTutor((v) => !v)}
                  className="group flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-purple-500/20 bg-purple-600/10 p-4 text-center hover-lift active-press transition-all duration-200 hover:bg-purple-600/20"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/20 text-purple-400 transition-transform group-hover:scale-110">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-purple-300">Consult Tutor</p>
                    <p className="mt-0.5 text-[9px] text-slate-500">AI copilot for concept</p>
                  </div>
                </button>
              </div>

              {/* Inline tutor */}
              {showTutor && (
                <CopilotSidebar
                  lessonId={node.lessonId}
                  currentCode=""
                  lastErrorLog={null}
                  onClose={() => setShowTutor(false)}
                  fallbackLessonTitle={node.key}
                  fallbackLessonContent={node.summary}
                />
              )}
            </div>
          </>
        )}
      </aside>
    </>
  );
}
