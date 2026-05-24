"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Brain,
  Target,
  Trophy,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Puzzle,
  Star,
  BookOpen,
  Zap,
  XCircle,
  CheckCircle,
} from "lucide-react";
import type { TheoryQuestionResult, ChallengeResult } from "@/app/api/exam/evaluate/route";
import CodeSortingGame from "@/components/review/CodeSortingGame";

// ─── Sub-Types ────────────────────────────────────────────────────────────────

export interface DiagnosticSummary {
  theoryScore: number;
  challengeScore: number;
  overallScore: number;
  overallGrade: string;
  totalTheoryMarks: number;
  earnedTheoryMarks: number;
}

export interface DiagnosticsViewProps {
  /** Graded theory question results from /api/exam/evaluate */
  theoryResults: TheoryQuestionResult[];
  /** Graded sandbox challenge results from /api/exam/evaluate */
  challengeResults: ChallengeResult[];
  /** Aggregated summary statistics */
  summary: DiagnosticSummary;
  /**
   * Recall node metadata keyed by concept key.
   * If a node has codeBlocks in metadata, the Parson's Problem game is available.
   */
  recallNodeMetadata?: Record<
    string,
    {
      codeBlocks?: { code: string; correctOrder: number }[];
      language?: string;
    }
  >;
  /** Called when the student requests a new exam attempt */
  onRetry?: () => void;
}

// ─── Internal Component: Expandable Critique Card ─────────────────────────────

interface CritiqueCardProps {
  result: TheoryQuestionResult;
  recallMeta?: { codeBlocks?: { code: string; correctOrder: number }[]; language?: string };
}

function CritiqueCard({ result, recallMeta }: CritiqueCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showGame, setShowGame] = useState(false);

  const hasCodeBlocks =
    Array.isArray(recallMeta?.codeBlocks) &&
    (recallMeta?.codeBlocks?.length ?? 0) >= 2;

  const handleGameSuccess = useCallback(() => {
    toast.success(
      "Excellent! Code pipeline sorted correctly. Concept reinforced.",
      { duration: 3000 }
    );
    setShowGame(false);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="rounded-2xl border border-rose-500/20 bg-rose-950/10 overflow-hidden"
    >
      {/* Card Header */}
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-start gap-3 p-4 text-left cursor-pointer hover:bg-rose-950/20 transition-colors group"
        aria-expanded={expanded}
      >
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-900/40 border border-rose-500/30 text-rose-400">
          <XCircle className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-rose-200 leading-tight">
              {result.questionText.length > 80
                ? result.questionText.slice(0, 80) + "…"
                : result.questionText}
            </p>
            <span className="ml-auto shrink-0 font-mono text-xs font-bold px-2 py-0.5 rounded-lg bg-rose-900/60 text-rose-300 border border-rose-500/20">
              {result.earnedMarks}/{result.maxMarks} marks
            </span>
          </div>

          <div className="flex items-center gap-3 mt-1.5">
            {/* Score bar */}
            <div className="flex-1 h-1.5 bg-rose-950/60 rounded-full overflow-hidden max-w-[160px]">
              <div
                className="h-full bg-rose-500 rounded-full transition-all duration-500"
                style={{ width: `${result.score}%` }}
              />
            </div>
            <span className="text-[11px] font-mono text-rose-400">
              {result.score}%
            </span>
            <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider">
              {result.targetedConceptKey}
            </span>
          </div>
        </div>

        {expanded ? (
          <ChevronUp className="h-4 w-4 text-rose-400 shrink-0 mt-1.5 group-hover:text-rose-300 transition-colors" />
        ) : (
          <ChevronDown className="h-4 w-4 text-rose-400 shrink-0 mt-1.5 group-hover:text-rose-300 transition-colors" />
        )}
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-rose-500/15">
              {/* AI Critique */}
              <div className="pt-3">
                <p className="text-[10px] uppercase font-bold tracking-wider text-rose-400/70 mb-1.5 flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  AI Examiner Critique
                </p>
                <p className="text-xs text-rose-100/80 leading-relaxed bg-rose-950/30 border border-rose-500/10 rounded-xl p-3">
                  {result.critique}
                </p>
              </div>

              {/* Rubric Breakdown */}
              {result.rubricBreakdown.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-rose-400/70 mb-2 flex items-center gap-1">
                    <Target className="h-3 w-3" />
                    Rubric Breakdown
                  </p>
                  <div className="space-y-1.5">
                    {result.rubricBreakdown.map((rb, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs border ${
                          rb.passed
                            ? "bg-emerald-950/20 border-emerald-500/20 text-emerald-200"
                            : "bg-rose-950/20 border-rose-500/20 text-rose-200"
                        }`}
                      >
                        {rb.passed ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <span className="font-semibold">{rb.criterion}:</span>{" "}
                          <span className="opacity-80">{rb.feedback}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Parson's Problem CTA or Game */}
              {hasCodeBlocks && (
                <div>
                  <AnimatePresence mode="wait">
                    {showGame ? (
                      <motion.div
                        key="game"
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        className="mt-2 rounded-2xl border border-violet-500/20 bg-violet-950/10 p-4"
                      >
                        <CodeSortingGame
                          codeBlocks={recallMeta!.codeBlocks!}
                          conceptTitle={`Reinforce: ${result.targetedConceptKey}`}
                          onSuccess={handleGameSuccess}
                        />
                        <button
                          onClick={() => setShowGame(false)}
                          className="mt-3 text-[11px] text-slate-400 hover:text-slate-200 underline cursor-pointer transition-colors"
                        >
                          Close game
                        </button>
                      </motion.div>
                    ) : (
                      <motion.button
                        key="cta"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowGame(true)}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-950/20 hover:bg-violet-950/40 px-4 py-2.5 text-xs font-bold text-violet-300 hover:text-violet-200 transition-all cursor-pointer group mt-1"
                      >
                        <Puzzle className="h-3.5 w-3.5 group-hover:rotate-12 transition-transform" />
                        Generate Targeted Parson's Problem Game
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Grade Ring ──────────────────────────────────────────────────────────────

function GradeRing({
  grade,
  score,
}: {
  grade: string;
  score: number;
}) {
  const circumference = 2 * Math.PI * 44; // r=44
  const dashOffset = circumference - (score / 100) * circumference;

  const gradeColor =
    score >= 80
      ? "text-emerald-400"
      : score >= 60
      ? "text-amber-400"
      : "text-rose-400";

  const strokeColor =
    score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : "#f87171";

  return (
    <div className="relative flex items-center justify-center w-28 h-28">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="44"
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-black font-mono ${gradeColor}`}>
          {grade}
        </span>
        <span className="text-[11px] text-slate-400 font-mono">{score}%</span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DiagnosticsView({
  theoryResults,
  challengeResults,
  summary,
  recallNodeMetadata = {},
  onRetry,
}: DiagnosticsViewProps) {
  // Partition results
  const masteredTheory = theoryResults.filter((r) => r.score >= 70);
  const failedTheory = theoryResults.filter((r) => r.score < 70);
  const masteredChallenges = challengeResults.filter((r) => r.isPassed);
  const failedChallenges = challengeResults.filter((r) => !r.isPassed);

  const totalQuestions = theoryResults.length + challengeResults.length;
  const passedCount = masteredTheory.length + masteredChallenges.length;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* ── Top Summary Bar ─────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-xl p-6 shadow-2xl relative overflow-hidden"
      >
        {/* Background decoration */}
        <div
          className={`absolute inset-0 opacity-[0.04] ${
            summary.overallScore >= 80
              ? "bg-gradient-to-br from-emerald-400 to-teal-600"
              : summary.overallScore >= 60
              ? "bg-gradient-to-br from-amber-400 to-orange-500"
              : "bg-gradient-to-br from-rose-400 to-red-600"
          }`}
        />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          {/* Grade ring */}
          <GradeRing
            grade={summary.overallGrade}
            score={summary.overallScore}
          />

          {/* Stats */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center sm:text-left">
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">
                Theory Score
              </p>
              <p className="text-2xl font-black font-mono text-slate-100">
                {summary.theoryScore}
                <span className="text-sm text-slate-400">%</span>
              </p>
              <p className="text-[11px] text-slate-500">
                {summary.earnedTheoryMarks}/{summary.totalTheoryMarks} marks
              </p>
            </div>

            {challengeResults.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">
                  Code Score
                </p>
                <p className="text-2xl font-black font-mono text-slate-100">
                  {summary.challengeScore}
                  <span className="text-sm text-slate-400">%</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {masteredChallenges.length}/{challengeResults.length} passed
                </p>
              </div>
            )}

            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">
                Questions
              </p>
              <p className="text-2xl font-black font-mono text-slate-100">
                {passedCount}
                <span className="text-sm text-slate-400">/{totalQuestions}</span>
              </p>
              <p className="text-[11px] text-slate-500">answered correctly</p>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500 mb-0.5">
                Overall Grade
              </p>
              <p
                className={`text-2xl font-black font-mono ${
                  summary.overallScore >= 80
                    ? "text-emerald-400"
                    : summary.overallScore >= 60
                    ? "text-amber-400"
                    : "text-rose-400"
                }`}
              >
                {summary.overallGrade}
              </p>
              <p className="text-[11px] text-slate-500">
                {summary.overallScore >= 80
                  ? "Excellent work"
                  : summary.overallScore >= 60
                  ? "Satisfactory"
                  : "Needs revision"}
              </p>
            </div>
          </div>

          {/* Retry button */}
          {onRetry && (
            <button
              onClick={onRetry}
              className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/60 hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              New Attempt
            </button>
          )}
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2 items-start">
        {/* ── LEFT: Mastered Concepts ────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-emerald-500/20">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-400">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <h2 className="font-heading text-sm font-bold text-emerald-300">
              Mastered Concepts
            </h2>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-emerald-950/40 text-emerald-400 rounded-full border border-emerald-500/25">
              {masteredTheory.length + masteredChallenges.length} items
            </span>
          </div>

          {masteredTheory.length === 0 && masteredChallenges.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/20 p-6 text-center">
              <Trophy className="h-8 w-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500 italic">
                No concepts scored above 70% this attempt.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {/* Theory mastery */}
                {masteredTheory.map((result, i) => (
                  <motion.div
                    key={`theory-mastered-${result.questionId}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-start gap-3 rounded-xl border border-emerald-500/15 bg-emerald-950/10 px-4 py-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-emerald-100 leading-snug line-clamp-2">
                        {result.questionText}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-900/40 text-emerald-300 rounded-full border border-emerald-500/20">
                          <Star className="h-2.5 w-2.5" />
                          {result.targetedConceptKey}
                        </span>
                        <span className="text-[10px] text-emerald-400/70 font-mono">
                          {result.score}% · {result.earnedMarks}/{result.maxMarks} marks
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 self-center font-mono text-xs font-black text-emerald-400">
                      {result.score}%
                    </span>
                  </motion.div>
                ))}

                {/* Challenge mastery */}
                {masteredChallenges.map((result, i) => (
                  <motion.div
                    key={`challenge-mastered-${result.challengeId}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: (masteredTheory.length + i) * 0.06 }}
                    className="flex items-center gap-3 rounded-xl border border-emerald-500/15 bg-emerald-950/10 px-4 py-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-emerald-100">
                        Code Challenge: {result.language.toUpperCase()}
                      </p>
                      <p className="text-[11px] text-emerald-400/70 font-mono mt-0.5">
                        {result.passedCount}/{result.totalCount} test cases ·{" "}
                        {result.score}%
                      </p>
                    </div>
                    <Zap className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.section>

        {/* ── RIGHT: Learning Gaps ───────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="space-y-3"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-rose-500/20">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-950/40 border border-rose-500/30 text-rose-400">
              <TrendingDown className="h-3.5 w-3.5" />
            </div>
            <h2 className="font-heading text-sm font-bold text-rose-300">
              Critical Learning Gaps Detected
            </h2>
            <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-rose-950/40 text-rose-400 rounded-full border border-rose-500/25">
              {failedTheory.length + failedChallenges.length} items
            </span>
          </div>

          {failedTheory.length === 0 && failedChallenges.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/20 p-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-60" />
              <p className="text-xs text-slate-500 italic">
                No learning gaps detected. Excellent performance!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {/* Theory failures with expandable critique */}
                {failedTheory.map((result) => (
                  <CritiqueCard
                    key={`theory-failed-${result.questionId}`}
                    result={result}
                    recallMeta={recallNodeMetadata[result.targetedConceptKey]}
                  />
                ))}

                {/* Failed code challenges */}
                {failedChallenges.map((result, i) => (
                  <motion.div
                    key={`challenge-failed-${result.challengeId}`}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3 rounded-xl border border-rose-500/20 bg-rose-950/10 px-4 py-3"
                  >
                    <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-rose-100">
                        Code Challenge: {result.language.toUpperCase()} — Failed
                      </p>
                      <p className="text-[11px] text-rose-400/70 font-mono mt-0.5">
                        {result.passedCount}/{result.totalCount} test cases passed
                        · {result.score}%
                      </p>
                    </div>
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.section>
      </div>

      {/* ── Bottom: Study Recommendation Strip ───────────────────────────── */}
      {failedTheory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="rounded-2xl border border-amber-500/20 bg-amber-950/10 p-5 flex items-start gap-4"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-950/40 border border-amber-500/30 text-amber-400">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-amber-200 mb-1">
              Targeted Revision Recommendations
            </h3>
            <p className="text-xs text-amber-100/70 leading-relaxed mb-3">
              Based on your exam performance, your error memory has been updated.
              Focus your next study session on:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {failedTheory.map((r) => (
                <span
                  key={r.questionId}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2.5 py-1 bg-amber-900/40 text-amber-300 rounded-lg border border-amber-500/20"
                >
                  <Target className="h-2.5 w-2.5" />
                  {r.targetedConceptKey}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
