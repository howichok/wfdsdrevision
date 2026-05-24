"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { RotateCcw, ChevronRight, CheckCircle, Clock, Shuffle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FlashNode {
  id: string;
  key: string;
  summary: string;
  nodeType: string;
  lessonId: string;
  lessonTitle: string | null;
  masteryScore: number;
  metadata: { codeSnippet?: string; language?: string } | null;
}

interface FlashcardDeckProps {
  /** Filter to specific lesson. Omit to show all. */
  lessonId?: string;
  /** Max cards to show. Default 20. */
  limit?: number;
}

const STUDY_TYPES = new Set(["core_concept", "syntax_rule", "common_pitfall"]);

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const NODE_PALETTE: Record<string, { label: string; cls: string }> = {
  core_concept: { label: "Core Concept", cls: "bg-indigo-500/10 text-indigo-400 border-indigo-500/25" },
  syntax_rule: { label: "Syntax Rule", cls: "bg-violet-500/10 text-violet-400 border-violet-500/25" },
  common_pitfall: { label: "Common Pitfall", cls: "bg-rose-500/10 text-rose-400 border-rose-500/25" },
};

function Flashcard({
  node,
  onKnow,
  onReview,
}: {
  node: FlashNode;
  onKnow: () => void;
  onReview: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const palette = NODE_PALETTE[node.nodeType] ?? { label: node.nodeType, cls: "bg-muted text-muted-foreground border-border" };

  return (
    <div className="flashcard-scene w-full" style={{ height: "360px" }}>
      <div className={cn("flashcard-inner", flipped && "flipped")}>

        {/* Front face */}
        <div className="flashcard-face rounded-2xl border border-border/40 bg-card/80 backdrop-blur-xl p-8 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide", palette.cls)}>
              {palette.label}
            </span>
            {node.lessonTitle && (
              <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{node.lessonTitle}</span>
            )}
          </div>

          <div className="flex-1 flex items-center justify-center">
            <h3 className="font-heading text-2xl font-bold text-center leading-snug">{node.key}</h3>
          </div>

          <button
            onClick={() => setFlipped(true)}
            className="mt-6 flex items-center justify-center gap-2 rounded-full bg-primary/10 border border-primary/20 hover:bg-primary/20 hover:border-primary/35 px-5 py-2.5 text-sm font-semibold text-primary transition-all hover-lift active-press cursor-pointer"
          >
            Reveal answer <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Back face */}
        <div className="flashcard-face flashcard-back-face rounded-2xl border border-indigo-500/25 bg-card/90 backdrop-blur-xl p-8 flex flex-col shadow-[0_0_30px_-8px_rgba(99,102,241,0.3)]">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setFlipped(false)}
              className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Flip back
            </button>
            <span className={cn("text-[10px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wide", palette.cls)}>
              {palette.label}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3">
            <p className="text-sm leading-relaxed text-foreground/90">{node.summary}</p>
            {node.metadata?.codeSnippet && (
              <pre className="rounded-xl bg-muted/60 border border-border/30 p-3 text-[11px] font-mono text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                {node.metadata.codeSnippet}
              </pre>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={onReview}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/8 hover:bg-amber-500/15 px-3 py-2.5 text-xs font-semibold text-amber-400 hover-lift active-press transition-all cursor-pointer"
            >
              <Clock className="h-3.5 w-3.5" /> Review later
            </button>
            <button
              onClick={onKnow}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/8 hover:bg-emerald-500/15 px-3 py-2.5 text-xs font-semibold text-emerald-400 hover-lift active-press transition-all cursor-pointer"
            >
              <CheckCircle className="h-3.5 w-3.5" /> I know this
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

export function FlashcardDeck({ lessonId, limit = 20 }: FlashcardDeckProps) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["graph-nodes"],
    queryFn: async () => {
      const res = await fetch("/api/graph/nodes");
      const json = await res.json() as { nodes: FlashNode[] };
      return json.nodes;
    },
    staleTime: 5 * 60 * 1000,
  });

  const [queue, setQueue] = useState<FlashNode[] | null>(null);
  const [known, setKnown] = useState<Set<string>>(new Set());
  const [reviewLater, setReviewLater] = useState<string[]>([]);

  const buildQueue = useCallback(
    (nodes: FlashNode[]) => {
      let filtered = nodes.filter((n) => STUDY_TYPES.has(n.nodeType));
      if (lessonId) filtered = filtered.filter((n) => n.lessonId === lessonId);
      setQueue(shuffle(filtered).slice(0, limit));
      setKnown(new Set());
      setReviewLater([]);
    },
    [lessonId, limit]
  );

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 space-y-6 relative overflow-hidden shadow-sm">
        <div className="absolute inset-0 animate-shimmer opacity-40 pointer-events-none" />
        <div className="flex justify-between items-center">
          <div className="h-6 w-24 bg-slate-100 rounded-lg" />
          <div className="h-6 w-32 bg-slate-100 rounded-lg" />
        </div>
        <div className="h-36 w-full bg-slate-50 rounded-2xl flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-slate-200 border-t-primary animate-spin" />
        </div>
        <div className="h-10 w-full bg-slate-100 rounded-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-rose-400">
        Failed to load flashcards.
      </div>
    );
  }

  if (!queue) {
    const allStudy = data.filter((n) => STUDY_TYPES.has(n.nodeType));
    const available = lessonId ? allStudy.filter((n) => n.lessonId === lessonId) : allStudy;
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16">
        <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-8 text-center max-w-sm w-full space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 mx-auto">
            <Shuffle className="h-6 w-6 text-primary" />
          </div>
          <h3 className="font-heading text-lg font-bold">Active Recall</h3>
          <p className="text-sm text-muted-foreground">
            {available.length} flashcards ready. Test yourself on core concepts, syntax rules, and common pitfalls.
          </p>
          <button
            onClick={() => buildQueue(data)}
            className="w-full rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:bg-primary/90 hover-lift active-press transition-all shadow-md shadow-primary/10 cursor-pointer"
          >
            Start Session
          </button>
        </div>
      </div>
    );
  }

  const remaining = queue.filter((n) => !known.has(n.id));
  const current = remaining[0];

  if (!current) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-16">
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-8 text-center max-w-sm w-full space-y-4">
          <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
          <h3 className="font-heading text-lg font-bold">Session complete!</h3>
          <p className="text-sm text-muted-foreground">
            {known.size} cards mastered · {reviewLater.length} marked for review
          </p>
          <div className="flex gap-3">
            {reviewLater.length > 0 && (
              <button
                onClick={() => {
                  const reviewNodes = queue.filter((n) => reviewLater.includes(n.id));
                  setQueue(shuffle(reviewNodes));
                  setKnown(new Set());
                  setReviewLater([]);
                }}
                className="flex-1 rounded-full border border-amber-500/30 bg-amber-500/8 px-4 py-2.5 text-xs font-semibold text-amber-400 hover:bg-amber-500/15 hover-lift active-press transition-all cursor-pointer"
              >
                Review {reviewLater.length} flagged
              </button>
            )}
            <button
              onClick={() => buildQueue(data)}
              className="flex-1 rounded-full bg-primary text-primary-foreground px-4 py-2.5 text-xs font-semibold hover:bg-primary/90 hover-lift active-press transition-all cursor-pointer"
            >
              New session
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium">{known.size} / {queue.length} mastered</span>
        <span className="tabular-nums">{remaining.length} remaining</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-500"
          style={{ width: `${(known.size / queue.length) * 100}%` }}
        />
      </div>

      {/* Current card */}
      <Flashcard
        key={current.id}
        node={current}
        onKnow={() => setKnown((prev) => new Set([...prev, current.id]))}
        onReview={() => {
          setReviewLater((prev) => [...prev, current.id]);
          setKnown((prev) => new Set([...prev, current.id]));
        }}
      />

      {/* Skip */}
      <div className="flex justify-center">
        <button
          onClick={() => setKnown((prev) => new Set([...prev, current.id]))}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip this card →
        </button>
      </div>
    </div>
  );
}
