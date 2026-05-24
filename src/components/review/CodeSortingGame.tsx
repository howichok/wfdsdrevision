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
  Play, 
  HelpCircle,
  Code2,
  ListOrdered
} from "lucide-react";

export interface CodeBlock {
  id: string;
  code: string;
  correctOrder: number;
}

interface CodeSortingGameProps {
  codeBlocks: { code: string; correctOrder: number }[];
  conceptTitle?: string;
  onSuccess?: () => void;
}

// 1. Draggable Block Component
function DraggableCodeBlock({
  block,
  isPlaced,
}: {
  block: CodeBlock;
  isPlaced: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
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
      className={`p-3.5 rounded-lg border font-mono text-xs select-none touch-none cursor-grab active:cursor-grabbing transition-all ${
        isDragging
          ? "bg-violet-950/60 border-violet-500/50 text-violet-200 shadow-lg shadow-violet-500/10 scale-105"
          : isPlaced
          ? "bg-slate-800/80 border-slate-700/80 text-slate-100 hover:border-slate-600"
          : "bg-slate-900/90 border-slate-800 text-slate-300 hover:border-violet-500/40 hover:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex flex-col gap-1.5 mt-0.5 text-slate-600">
          <div className="w-3.5 h-0.5 bg-current rounded" />
          <div className="w-3.5 h-0.5 bg-current rounded" />
          <div className="w-2.5 h-0.5 bg-current rounded" />
        </div>
        <pre className="whitespace-pre-wrap break-all overflow-x-auto text-left leading-relaxed w-full">
          <code>{block.code}</code>
        </pre>
      </div>
    </div>
  );
}

// 2. Droppable Slot Component
function DroppableSlot({
  index,
  block,
  isCorrect,
  showResults,
}: {
  index: number;
  block: CodeBlock | null;
  isCorrect: boolean | null;
  showResults: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `slot-${index}`,
  });

  let slotStyle = "border-slate-800 bg-slate-950/30 text-slate-500";
  if (isOver) {
    slotStyle = "border-violet-500/50 bg-violet-950/20 text-violet-400 scale-[1.01]";
  } else if (block) {
    if (showResults) {
      slotStyle = isCorrect
        ? "border-emerald-500/50 bg-emerald-950/10 text-emerald-200"
        : "border-rose-500/50 bg-rose-950/10 text-rose-200 animate-pulse-fast";
    } else {
      slotStyle = "border-slate-700 bg-slate-900/50 text-slate-300";
    }
  }

  const stepLabels = [
    "Step 1: Input / Setup",
    "Step 2: Core Algorithm / Loop",
    "Step 3: Return / Output",
  ];

  return (
    <div className="space-y-1.5 w-full">
      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1.5">
        <ListOrdered className="w-3.5 h-3.5" />
        {stepLabels[index] || `Step ${index + 1}`}
      </div>
      
      <div
        ref={setNodeRef}
        className={`relative min-h-[72px] rounded-xl border-2 border-dashed p-1 flex items-center justify-center transition-all duration-300 ${slotStyle}`}
      >
        {block ? (
          <div className="w-full h-full">
            <DraggableCodeBlock block={block} isPlaced={true} />
            {showResults && (
              <div className="absolute right-3 top-3">
                {isCorrect ? (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30">
                    Correct
                  </span>
                ) : (
                  <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/30">
                    Incorrect
                  </span>
                )}
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs py-5">
            {isOver ? "Release to drop block" : "Drag a code block here"}
          </span>
        )}
      </div>
    </div>
  );
}

// 3. Droppable Pool Component
function DroppablePool({
  children,
  isEmpty,
}: {
  children: React.ReactNode;
  isEmpty: boolean;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: "pool",
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[140px] rounded-2xl border border-slate-800 bg-slate-900/20 p-4 transition-colors ${
        isOver ? "bg-slate-900/40 border-slate-700" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Code2 className="w-4 h-4 text-violet-400" />
          Scrambled Code Blocks
        </h4>
        <span className="text-[10px] font-mono px-2 py-0.5 bg-slate-800 text-slate-500 rounded-full border border-slate-700/60">
          Source Pool
        </span>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-center justify-center min-h-[90px] text-center border border-dashed border-slate-800/80 rounded-xl bg-slate-950/20">
          <p className="text-xs text-slate-500 italic">All blocks placed in the pipeline!</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {children}
        </div>
      )}
    </div>
  );
}

export default function CodeSortingGame({
  codeBlocks,
  conceptTitle = "Code Pipeline Sorting",
  onSuccess,
}: CodeSortingGameProps) {
  const [initialBlocks, setInitialBlocks] = useState<CodeBlock[]>([]);
  const [pool, setPool] = useState<CodeBlock[]>([]);
  const [slots, setSlots] = useState<(CodeBlock | null)[]>([null, null, null]);
  
  const [showResults, setShowResults] = useState(false);
  const [isGameFinished, setIsGameFinished] = useState(false);

  // Initialize and scramble blocks
  const resetGame = () => {
    // Generate simple stable IDs based on the correct order or indices
    const normalized = codeBlocks.map((b, i) => ({
      id: `block-${i}`,
      code: b.code,
      correctOrder: b.correctOrder,
    }));
    
    setInitialBlocks(normalized);
    setSlots([null, null, null]);
    setShowResults(false);
    setIsGameFinished(false);

    // Scramble the blocks
    const scrambled = [...normalized].sort(() => Math.random() - 0.5);
    setPool(scrambled);
  };

  useEffect(() => {
    resetGame();
  }, [codeBlocks]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const block = initialBlocks.find((b) => b.id === activeId);
    if (!block) return;

    if (overId === "pool") {
      // Put block back in the pool
      setSlots((prev) => prev.map((s) => (s?.id === activeId ? null : s)));
      setPool((prev) => {
        if (prev.some((b) => b.id === activeId)) return prev;
        return [...prev, block];
      });
      setShowResults(false);
    } else if (overId.startsWith("slot-")) {
      const slotIndex = parseInt(overId.split("-")[1], 10);
      if (isNaN(slotIndex) || slotIndex < 0 || slotIndex > 2) return;

      setSlots((prev) => {
        const newSlots = [...prev];
        const displacedBlock = newSlots[slotIndex];

        // Was the dragged block previously in another slot?
        const prevSlotIndex = newSlots.findIndex((s) => s?.id === activeId);
        if (prevSlotIndex !== -1) {
          newSlots[prevSlotIndex] = displacedBlock; // Swap
        } else {
          // Dragged from pool
          setPool((p) => p.filter((b) => b.id !== activeId));
          if (displacedBlock) {
            setPool((p) => [...p, displacedBlock]); // Put displaced back in pool
          }
        }

        newSlots[slotIndex] = block;
        return newSlots;
      });
      setShowResults(false);
    }
  };

  const validateOrder = () => {
    // Check if all slots are filled
    const unfilledIndex = slots.findIndex((s) => s === null);
    if (unfilledIndex !== -1) {
      toast.warning("Please place all code blocks into the pipeline before validating.");
      return;
    }

    setShowResults(true);

    // Verify correct order matches slot index
    const isCorrect = slots.every((block, idx) => block !== null && block.correctOrder === idx);

    if (isCorrect) {
      setIsGameFinished(true);
      toast.success("Awesome! The code blocks are sorted in the correct sequence.", {
        duration: 3000,
      });
      if (onSuccess) {
        onSuccess();
      }
    } else {
      toast.error("Incorrect code order. Check the pipeline flow and try again.", {
        duration: 3000,
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Game Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="font-heading text-lg font-bold flex items-center gap-2 text-white">
            <Sparkles className="w-5 h-5 text-violet-400 animate-pulse" />
            {conceptTitle}
          </h3>
          <p className="text-xs text-slate-400">
            Reconstruct the execution pipeline by dragging blocks into Step 1, 2, and 3.
          </p>
        </div>

        <button
          onClick={resetGame}
          className="self-start sm:self-center inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 transition-all text-xs font-semibold text-slate-300 hover:text-white"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset
        </button>
      </div>

      <DndContext onDragEnd={handleDragEnd}>
        <div className="grid gap-6 md:grid-cols-5 items-start">
          {/* Draggable Pool */}
          <div className="md:col-span-2">
            <DroppablePool isEmpty={pool.length === 0}>
              <AnimatePresence>
                {pool.map((block) => (
                  <motion.div
                    key={block.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <DraggableCodeBlock block={block} isPlaced={false} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </DroppablePool>
          </div>

          {/* Droppable Pipeline Slots */}
          <div className="md:col-span-3 space-y-4 bg-slate-900/10 border border-slate-800/40 rounded-2xl p-5">
            <div className="space-y-4">
              {slots.map((block, idx) => {
                const isCorrect = block ? block.correctOrder === idx : null;
                return (
                  <DroppableSlot
                    key={idx}
                    index={idx}
                    block={block}
                    isCorrect={isCorrect}
                    showResults={showResults}
                  />
                );
              })}
            </div>

            {/* Validation Action */}
            <div className="pt-3 border-t border-slate-800/80 flex justify-end">
              {isGameFinished ? (
                <div className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-xl">
                  <CheckCircle2 className="w-4 h-4" />
                  Sorted Correctly
                </div>
              ) : (
                <button
                  onClick={validateOrder}
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:opacity-90 px-4.5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md shadow-violet-500/10 active:scale-95 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                  Validate Sequence
                </button>
              )}
            </div>
          </div>
        </div>
      </DndContext>

      <style jsx global>{`
        @keyframes pulse-fast {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .animate-pulse-fast {
          animation: pulse-fast 1.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
