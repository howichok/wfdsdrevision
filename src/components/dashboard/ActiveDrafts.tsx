"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Code2,
  FileQuestion,
  Trash2,
  ArrowRight,
  LayoutGrid,
  AlertCircle,
} from "lucide-react";
import { useSortedDrafts, useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { WorkspaceDraft, WorkspaceType } from "@/store/useWorkspaceStore";

// ─── Relative Time ────────────────────────────────────────────────────────────
function relativeTime(ts: number): string {
  if (!ts) return "Never accessed";
  const diff = Date.now() - ts;
  const secs = Math.floor(diff / 1000);
  if (secs < 5) return "Just now";
  if (secs < 60) return `${secs} seconds ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ─── Type-to-visual mappings ──────────────────────────────────────────────────
interface TypeConfig {
  icon: React.ReactNode;
  label: string;
  badgeClass: string;
  route: (id: string) => string;
}

function getTypeConfig(type: WorkspaceType): TypeConfig {
  switch (type) {
    case "lesson":
      return {
        icon: <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />,
        label: "Lesson",
        badgeClass: "bg-violet-500/10 text-violet-400 border-violet-500/15",
        route: (id) => `/lessons/${id}`,
      };
    case "exam":
      return {
        icon: <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />,
        label: "Exam",
        badgeClass: "bg-rose-500/10 text-rose-450 border-rose-500/15",
        route: (id) => `/exam-prep`,
      };
    case "practice_question":
      return {
        icon: <FileQuestion className="h-3.5 w-3.5" aria-hidden="true" />,
        label: "Practice",
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/15",
        route: (id) => `/revision`,
      };
    default:
      return {
        icon: <Code2 className="h-3.5 w-3.5" aria-hidden="true" />,
        label: "Workspace",
        badgeClass: "bg-slate-500/10 text-slate-400 border-slate-700/15",
        route: (id) => `/lessons/${id}`,
      };
  }
}

// ─── Single Resume Card ───────────────────────────────────────────────────────
interface ResumeCardProps {
  draft: WorkspaceDraft;
  onClear: (id: string) => void;
}

function ResumeCard({ draft, onClear }: ResumeCardProps) {
  const config = getTypeConfig(draft.type);
  const [relTime, setRelTime] = useState(() => relativeTime(draft.lastAccessed));
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRelTime(relativeTime(draft.lastAccessed));
    }, 30_000);
    return () => clearInterval(interval);
  }, [draft.lastAccessed]);

  const hasEditorContent =
    draft.editorState.length > 10 && draft.editorState !== '{"type":"doc","content":[]}';
  const sandboxFileCount = Object.keys(draft.sandboxCode).length;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -6 }}
      transition={{ duration: 0.2 }}
      className="relative group flex flex-col justify-between p-4 rounded-xl border border-white/5 bg-slate-950/15 hover:bg-slate-950/30 hover:border-white/10 transition-all shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <Link href={config.route(draft.id)} className="flex items-start gap-3 flex-1 min-w-0">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded border ${config.badgeClass}`}
          >
            {config.icon}
          </div>
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-xs font-bold text-slate-200 leading-tight group-hover:underline truncate">
              {draft.title}
            </h3>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
                {config.label}
              </span>
              <span className="text-slate-700">•</span>
              <span className="text-[9px] text-slate-555">{relTime}</span>
            </div>
          </div>
        </Link>

        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirmDelete) {
              onClear(draft.id);
            } else {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 3000);
            }
          }}
          className="shrink-0 p-1 rounded text-slate-650 hover:text-rose-450 hover:bg-rose-950/20 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100 cursor-pointer"
          title={confirmDelete ? "Click again to confirm removal" : "Remove workspace"}
          aria-label={confirmDelete ? "Confirm removal" : `Remove ${draft.title}`}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5">
        <div className="flex gap-1.5">
          {hasEditorContent && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-500">
              <BookOpen className="h-2.5 w-2.5" /> Notes
            </span>
          )}
          {sandboxFileCount > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] text-slate-500">
              <Code2 className="h-2.5 w-2.5" /> {sandboxFileCount} files
            </span>
          )}
        </div>

        <Link
          href={config.route(draft.id)}
          className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:underline"
        >
          Resume <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>

      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 2 }}
            className="absolute top-2 right-9 text-[8px] font-bold text-rose-300 bg-rose-950/90 border border-rose-500/20 rounded px-1.5 py-0.5 shadow-lg pointer-events-none"
          >
            Confirm
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="col-span-full flex flex-col items-center justify-center rounded-xl border border-dashed border-white/5 bg-slate-950/5 p-8 text-center"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-slate-950/20 text-slate-650">
        <LayoutGrid className="h-5 w-5" />
      </div>
      <p className="text-xs font-bold text-slate-400">No Active Workspaces</p>
      <p className="mt-1 text-[10px] text-slate-500 max-w-[220px] leading-relaxed">
        Open a lesson or start an exam — your progress will be captured here automatically.
      </p>
      <Link
        href="/lessons"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-violet-500/20 bg-violet-950/15 hover:bg-violet-950/30 px-3 py-1.5 text-[10px] font-bold text-violet-300 transition-all cursor-pointer active:scale-[0.98]"
      >
        <BookOpen className="h-3 w-3" />
        Browse Lessons
      </Link>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ActiveDrafts() {
  const sortedDrafts = useSortedDrafts();
  const clearDraft = useWorkspaceStore((s) => s.clearDraft);

  const visibleDrafts = sortedDrafts.filter((d) => {
    const ageMs = Date.now() - d.lastAccessed;
    const tooOld = ageMs > 48 * 60 * 60 * 1000;
    const isEmpty =
      !d.editorState &&
      Object.keys(d.sandboxCode).length === 0 &&
      ageMs > 5 * 60 * 1000;
    return !tooOld && !isEmpty;
  });

  return (
    <section className="space-y-4" aria-label="Active workspace hub">
      {/* Unified Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <LayoutGrid className="h-3.5 w-3.5 text-slate-400" />
          <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            Active Workspaces
          </h2>
        </div>

        {visibleDrafts.length > 0 && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/10 uppercase tracking-wider">
            {visibleDrafts.length} active
          </span>
        )}
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {visibleDrafts.length === 0 ? (
            <EmptyState key="empty" />
          ) : (
            visibleDrafts.map((draft) => (
              <ResumeCard
                key={draft.id}
                draft={draft}
                onClear={clearDraft}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
