"use client";

import React, { useState, useEffect } from "react";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { 
  Sparkles, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  GraduationCap, 
  Check, 
  Loader2, 
  X
} from "lucide-react";

type ErrorItem = {
  id: string;
  concept: string;
  errorContext: string;
  solution: string;
  masteryScore: number;
};

// 1. Draggable Concept Component
function DraggableConceptCard({ 
  id, 
  concept 
}: { 
  id: string; 
  concept: string; 
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `concept-${id}`,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: 50,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-lg border font-semibold text-sm transition-all shadow-sm select-none touch-none cursor-grab active:cursor-grabbing ${
        isDragging
          ? "bg-blue-50 border-blue-400 text-blue-800 opacity-80 scale-102"
          : "bg-white border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-blue-600" />
        {concept}
      </div>
    </div>
  );
}

// 2. Droppable Solution Slot Component
function DroppableSolutionSlot({
  id,
  solution,
  errorContext,
  matchedConcept,
  isWrong,
  onClearWrong,
}: {
  id: string;
  solution: string;
  errorContext: string;
  matchedConcept?: string;
  isWrong?: boolean;
  onClearWrong: () => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `solution-${id}`,
  });

  // Clear wrong state after short delay
  useEffect(() => {
    if (isWrong) {
      const timer = setTimeout(onClearWrong, 1000);
      return () => clearTimeout(timer);
    }
  }, [isWrong, onClearWrong]);

  return (
    <div
      ref={setNodeRef}
      className={`relative p-5 rounded-lg border transition-all duration-300 flex flex-col justify-between min-h-[140px] shadow-sm ${
        matchedConcept
          ? "border-emerald-200 bg-emerald-50 text-slate-800"
          : isWrong
          ? "border-rose-200 bg-rose-50 text-slate-800 animate-shake"
          : isOver
          ? "border-blue-400 bg-blue-50 text-slate-800 scale-[1.01]"
          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
      }`}
    >
      <div className="space-y-2">
        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
          <AlertCircle className="w-3 h-3 text-amber-600" />
          Error Context:
        </div>
        <p className="text-xs text-slate-600 italic font-mono leading-relaxed bg-white border border-slate-100 p-2 rounded">
          "{errorContext}"
        </p>

        <div className="h-px bg-slate-200 my-2" />

        <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          AI Definition & Solution:
        </div>
        <p className="text-xs leading-relaxed text-slate-700">
          {solution}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-end">
        {matchedConcept ? (
          <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200 uppercase tracking-wider">
            <Check className="w-3.5 h-3.5" />
            Matched: {matchedConcept}
          </div>
        ) : isWrong ? (
          <div className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full border border-rose-200 uppercase tracking-wider">
            <X className="w-3.5 h-3.5" />
            Incorrect Match
          </div>
        ) : (
          <div className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${
            isOver 
              ? "bg-blue-100 text-blue-800 border-blue-200" 
              : "bg-slate-250 text-slate-500 border-slate-300"
          }`}>
            Drop Concept Here
          </div>
        )}
      </div>
    </div>
  );
}

// 3. Shuffling Helper
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function ErrorMatchingGame() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<ErrorItem[]>([]);
  const [shuffledConcepts, setShuffledConcepts] = useState<{ id: string; concept: string }[]>([]);
  const [shuffledSolutions, setShuffledSolutions] = useState<ErrorItem[]>([]);
  
  // Game states
  const [matches, setMatches] = useState<Record<string, string>>({}); // solutionId -> conceptId
  const [matchedConceptIds, setMatchedConceptIds] = useState<string[]>([]);
  const [wrongAttempts, setWrongAttempts] = useState<Record<string, number>>({}); // conceptId -> count
  const [wrongSlots, setWrongSlots] = useState<Record<string, boolean>>({}); // solutionId -> isWrong
  const [gameFinished, setGameFinished] = useState(false);

  // Fetch error records
  const fetchErrors = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/error-memory");
      if (!res.ok) throw new Error("Failed to load review items");
      const data = (await res.json()) as ErrorItem[];
      setErrors(data);
      initializeGame(data);
    } catch (err: any) {
      toast.error(err.message || "Could not retrieve error memory data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchErrors();
  }, []);

  const initializeGame = (itemsList: ErrorItem[]) => {
    setMatches({});
    setMatchedConceptIds([]);
    setWrongAttempts({});
    setWrongSlots({});
    setGameFinished(false);
    
    // Shuffle concepts for the drag deck
    const concepts = itemsList.map((item) => ({ id: item.id, concept: item.concept }));
    setShuffledConcepts(shuffleArray(concepts));
    
    // Shuffle solutions independently for the drop targets
    setShuffledSolutions(shuffleArray(itemsList));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const conceptId = activeId.replace("concept-", "");
    const solutionId = overId.replace("solution-", "");

    if (conceptId === solutionId) {
      // SUCCESS MATCH
      const conceptObj = errors.find((e) => e.id === conceptId);
      
      setMatches((prev) => ({ ...prev, [solutionId]: conceptId }));
      setMatchedConceptIds((prev) => [...prev, conceptId]);
      
      toast.success(`Correct! "${conceptObj?.concept}" matched.`, {
        duration: 1500,
      });

      // Check if all items matched
      if (matchedConceptIds.length + 1 === errors.length) {
        setGameFinished(true);
      }
    } else {
      // INCORRECT MATCH
      const conceptObj = errors.find((e) => e.id === conceptId);
      setWrongAttempts((prev) => ({
        ...prev,
        [conceptId]: (prev[conceptId] || 0) + 1,
      }));
      
      setWrongSlots((prev) => ({ ...prev, [solutionId]: true }));
      
      toast.error(`Incorrect! Try reviewing the concept definition again.`, {
        duration: 2000,
      });
    }
  };

  const handleClearWrong = (solutionId: string) => {
    setWrongSlots((prev) => ({ ...prev, [solutionId]: false }));
  };

  // Score mapping based on mistakes
  const getConceptScore = (conceptId: string) => {
    const mistakes = wrongAttempts[conceptId] || 0;
    if (mistakes === 0) return 100;
    if (mistakes === 1) return 70;
    if (mistakes === 2) return 40;
    return 15;
  };

  const getAverageScore = () => {
    if (errors.length === 0) return 0;
    const total = errors.reduce((acc, curr) => acc + getConceptScore(curr.id), 0);
    return Math.round(total / errors.length);
  };

  const submitMasteryScores = async () => {
    setSubmitting(true);
    try {
      const updates = errors.map((item) => ({
        id: item.id,
        masteryScore: getConceptScore(item.id),
      }));

      const res = await fetch("/api/ai/error-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });

      if (!res.ok) throw new Error("Failed to save progress");
      
      toast.success("Progress saved! Mastery levels updated in error memory.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update error memory scores.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-slate-500">Loading error review cards...</p>
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div className="text-center p-8 border border-dashed border-slate-200 rounded-lg bg-slate-50 text-slate-700">
        <AlertCircle className="w-8 h-8 text-amber-600 mx-auto mb-2" />
        <h3 className="font-heading text-lg font-bold mb-1">No Errors Logged</h3>
        <p className="text-sm text-slate-500">
          Good job! You don't have any concept weaknesses in database error memory. Complete lessons and tests to generate review logs.
        </p>
      </div>
    );
  }

  const remainingConcepts = shuffledConcepts.filter((c) => !matchedConceptIds.includes(c.id));

  return (
    <div className="space-y-8">
      {/* Game Header Progress */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h2 className="font-heading text-xl font-bold flex items-center gap-2 text-slate-800">
            <GraduationCap className="w-5 h-5 text-blue-600" />
            Concept Revision Matching Board
          </h2>
          <p className="text-xs text-slate-500">
            Drag the concepts from the deck and drop them into their correct explanation slot.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-xs font-bold text-slate-600">
              Matched Progress: {matchedConceptIds.length} / {errors.length}
            </span>
            <div className="w-36 h-2 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
              <div 
                className="h-full bg-blue-600 transition-all duration-500" 
                style={{ width: `${(matchedConceptIds.length / errors.length) * 100}%` }}
              />
            </div>
          </div>

          <button
            onClick={() => initializeGame(errors)}
            className="p-2 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors text-slate-600 hover:text-slate-900"
            title="Reset Game"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!gameFinished ? (
          <DndContext onDragEnd={handleDragEnd}>
            <div className="grid gap-8 lg:grid-cols-12 items-start">
              {/* Draggable Deck */}
              <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-lg p-5 space-y-4 sticky top-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-sm font-bold text-slate-700">
                    Draggable Deck
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded-full border border-slate-300">
                    {remainingConcepts.length} remaining
                  </span>
                </div>

                <div className="flex flex-col gap-3 min-h-[100px]">
                  {remainingConcepts.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs italic">
                      All items placed. Great work!
                    </div>
                  ) : (
                    remainingConcepts.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                      >
                        <DraggableConceptCard id={item.id} concept={item.concept} />
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Droppable Board */}
              <div className="lg:col-span-8 grid gap-4 sm:grid-cols-2">
                {shuffledSolutions.map((item) => {
                  const matchedId = matches[item.id];
                  const matchedObj = errors.find((e) => e.id === matchedId);
                  
                  return (
                    <DroppableSolutionSlot
                      key={item.id}
                      id={item.id}
                      solution={item.solution}
                      errorContext={item.errorContext}
                      matchedConcept={matchedObj?.concept}
                      isWrong={wrongSlots[item.id]}
                      onClearWrong={() => handleClearWrong(item.id)}
                    />
                  );
                })}
              </div>
            </div>
          </DndContext>
        ) : (
          /* Game Complete Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-w-2xl mx-auto bg-white border border-slate-200 p-8 rounded-lg text-center space-y-8 shadow-sm relative overflow-hidden"
          >
            <div className="space-y-2 relative">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto text-emerald-600">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="font-heading text-2xl font-bold tracking-tight text-slate-800 mt-4">
                Revision Board Mastered!
              </h3>
              <p className="text-sm text-slate-600">
                You successfully reconciled all database student error logs with their AI-corrected definitions.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto bg-slate-50 border border-slate-200 p-4 rounded-lg relative">
              <div className="text-center border-r border-slate-200">
                <div className="text-2xl font-bold text-emerald-600 font-mono">
                  {getAverageScore()}%
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                  Avg Mastery Score
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 font-mono">
                  {errors.length}
                </div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">
                  Concepts Resolved
                </div>
              </div>
            </div>

            {/* Concepts Breakdown */}
            <div className="text-left space-y-3 max-w-md mx-auto relative">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Concept Mastery Breakdown:
              </h4>
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
                {errors.map((item) => {
                  const score = getConceptScore(item.id);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-slate-800">
                          {item.concept}
                        </span>
                        <span className="text-[10px] text-slate-500 italic line-clamp-1">
                          Mistakes: {wrongAttempts[item.id] || 0}
                        </span>
                      </div>
                      <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                        score === 100
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : score >= 70
                          ? "bg-blue-100 text-blue-800 border border-blue-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}>
                        {score}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-slate-200 relative">
              <button
                onClick={() => initializeGame(errors)}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded border border-slate-200 bg-slate-100 hover:bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Reset & Replay
              </button>

              <button
                onClick={submitMasteryScores}
                disabled={submitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded bg-blue-600 hover:bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    Save Mastery & End
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tailwind shake animation style injection */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-4px); }
          40%, 80% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}
