 "use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export interface SyncItem {
  id: string;
  sender: string;
  content: string;
  createdAt: string;
  isProcessed: boolean;
}

export interface GapItem {
  id: string;
  lessonId: string;
  nodeType: string;
  key: string;
  summary: string;
  masteryScore: number;
}

interface Flashcard {
  id: string;
  front: string;
  back: string;
  lessonId?: string;
  conceptKey: string;
  masteryScore?: number;
  type: "gap" | "system";
}

interface NoticeBoardAndFlashcardsProps {
  activeTopic?: string | null;
  syncsList: SyncItem[];
  gapsList: GapItem[];
}

const FALLBACK_FLASHCARDS: Flashcard[] = [
  {
    id: "system-bcnf",
    conceptKey: "Boyce-Codd Normal Form (BCNF)",
    front: "What is the requirement for a table to be in Boyce-Codd Normal Form (BCNF)?",
    back: "A relation is in BCNF if and only if for every functional dependency X → Y, X is a superkey. BCNF eliminates all anomalies caused by functional dependencies.",
    type: "system",
  },
  {
    id: "system-acid",
    conceptKey: "ACID Database Transaction Properties",
    front: "Explain the ACID properties of database transactions.",
    back: "Atomicity (all or nothing), Consistency (preserves constraints), Isolation (independent execution), and Durability (survives crashes).",
    type: "system",
  },
  {
    id: "system-cascade",
    conceptKey: "CASCADE vs RESTRICT Referential Actions",
    front: "What is the difference between CASCADE and RESTRICT action rules on DELETE?",
    back: "CASCADE automatically deletes dependent child rows when the parent row is deleted. RESTRICT aborts the delete if dependent child rows exist.",
    type: "system",
  },
  {
    id: "system-lossless",
    conceptKey: "Lossless-Join Decomposition",
    front: "What makes a database schema decomposition 'lossless-join'?",
    back: "A decomposition is lossless-join if the natural join of the decomposed relations recovers the exact original relation without creating fake rows.",
    type: "system",
  },
  {
    id: "system-3nf",
    conceptKey: "Third Normal Form (3NF)",
    front: "How do you achieve Third Normal Form (3NF)?",
    back: "A relation is in 3NF if it is in 2NF and has no transitive functional dependencies on the primary key (no non-prime attribute depends on another non-prime).",
    type: "system",
  },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export default function NoticeBoardAndFlashcards({
  activeTopic,
  syncsList,
  gapsList,
}: NoticeBoardAndFlashcardsProps) {
  const [currentCardIdx, setCurrentCardIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const active = activeTopic ? normalize(activeTopic) : null;

  const flashcards: Flashcard[] = useMemo(() => {
    const gapCards = gapsList.map((gap) => ({
      id: `gap-${gap.id}`,
      conceptKey: gap.key,
      front: `Explain the concept of: ${gap.key}`,
      back: gap.summary,
      lessonId: gap.lessonId,
      masteryScore: gap.masteryScore,
      type: "gap" as const,
    }));

    const combined: Flashcard[] = [...gapCards];
    for (const fb of FALLBACK_FLASHCARDS) {
      if (combined.length >= 5) break;
      if (!combined.some((c) => c.conceptKey.toLowerCase() === fb.conceptKey.toLowerCase())) {
        combined.push(fb);
      }
    }
    return combined.length > 0 ? combined : FALLBACK_FLASHCARDS;
  }, [gapsList]);

  const handleNext = () => {
    setCurrentCardIdx((prev) => (prev + 1) % flashcards.length);
  };

  const handlePrev = () => {
    setCurrentCardIdx((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const topicalCards = active
    ? flashcards.filter((card) => normalize(card.conceptKey).includes(active))
    : flashcards;

  const scopedCards = topicalCards.length ? topicalCards : flashcards;
  const activeCard = scopedCards[currentCardIdx % scopedCards.length];

  const scopedGaps = active
    ? gapsList.filter((gap) => normalize(gap.key).includes(active))
    : gapsList;

  const scopedSyncs = active
    ? syncsList.filter((sync) => normalize(sync.content).includes(active) || normalize(sync.sender).includes(active))
    : syncsList;

  return (
    <div className="space-y-6">
      <section className="zenith-surface px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            AI Note
          </p>
          <span className="inline-flex items-center gap-1 text-[10px] text-primary font-semibold">
            <Sparkles className="h-3 w-3" />
            Context aware
          </span>
        </div>
        <div className="mt-3 space-y-2">
          <h4 className="text-sm font-semibold text-foreground">{activeCard.conceptKey}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {showAnswer ? activeCard.back : activeCard.front}
          </p>
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrev}
                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/70 hover:bg-accent"
                aria-label="Previous flashcard"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-border/70 hover:bg-accent"
                aria-label="Next flashcard"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="text-[11px] text-muted-foreground ml-2">
                {currentCardIdx + 1}/{scopedCards.length}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAnswer((v) => !v)}
              className="text-xs font-semibold text-primary hover:underline"
            >
              {showAnswer ? "Hide" : "Reveal"}
            </button>
          </div>
        </div>
      </section>

      <section className="zenith-surface px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Practice Gaps
          </p>
          <span className="text-xs font-semibold text-foreground">{scopedGaps.length}</span>
        </div>
        <ul className="mt-3 space-y-3">
          {(scopedGaps.length ? scopedGaps : gapsList).slice(0, 3).map((gap) => (
            <li key={gap.id} className="border-b border-border/45 pb-3 last:border-b-0">
              <p className="text-sm font-medium text-foreground">{gap.key}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{gap.summary}</p>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className={cn("font-semibold", gap.masteryScore < 50 ? "text-rose-500" : "text-amber-500")}>
                  {gap.masteryScore}% mastery
                </span>
                <Link href={`/lessons/${gap.lessonId}`} className="text-primary font-semibold inline-flex items-center gap-1">
                  Practice <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="zenith-surface px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Lessons Feed
          </p>
          <Link href="/teams" className="text-xs font-semibold text-primary">
            Open Teams
          </Link>
        </div>
        <ul className="mt-3 space-y-3">
          {(scopedSyncs.length ? scopedSyncs : syncsList).slice(0, 3).map((sync) => (
            <li key={sync.id} className="border-b border-border/45 pb-3 last:border-b-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground truncate">{sync.sender}</p>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(sync.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{sync.content}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
