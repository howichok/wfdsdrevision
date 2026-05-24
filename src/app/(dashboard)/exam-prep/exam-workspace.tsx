"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  Loader2,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Trophy,
  ArrowLeft,
  Clock,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GeneratedExam } from "@/app/api/exam/generate/route";

interface ExamConfig {
  topic: string;
  length: string;
  cognitiveTarget: string;
}

type ExamState = "config" | "generating" | "taking" | "grading" | "results";

interface ExamWorkspaceProps {
  externalTopic?: string;
  externalLength?: string;
  onClearExternal?: () => void;
}

export function ExamWorkspace({
  externalTopic,
  externalLength,
  onClearExternal,
}: ExamWorkspaceProps) {
  const [state, setState] = useState<ExamState>("config");
  const [config, setConfig] = useState<ExamConfig>({
    topic: "Database Normalization (1NF, 2NF, 3NF)",
    length: "Standard Lab Practice (30 mins / 40 pts)",
    cognitiveTarget: "Hybrid Exam Mock",
  });
  const [exam, setExam] = useState<GeneratedExam | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<any>(null);

  useEffect(() => {
    if (externalTopic) {
      setConfig({
        topic: externalTopic,
        length: externalLength || "Standard Lab Practice (30 mins / 40 pts)",
        cognitiveTarget: "Hybrid Exam Mock",
      });

      const autoGenerate = async () => {
        setState("generating");
        try {
          const res = await fetch("/api/exam/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              topic: externalTopic,
              length: externalLength || "Standard Lab Practice (30 mins / 40 pts)",
              cognitiveTarget: "Hybrid Exam Mock",
            }),
          });
          if (!res.ok) throw new Error("Failed to generate exam");
          const data: GeneratedExam = await res.json();
          setExam(data);
          setAnswers({});
          setState("taking");
        } catch (err: any) {
          toast.error(err.message || "Could not generate exam. Check your AI API key.");
          setState("config");
        } finally {
          if (onClearExternal) {
            onClearExternal();
          }
        }
      };

      autoGenerate();
    }
  }, [externalTopic, externalLength, onClearExternal]);

  const handleGenerate = async () => {
    setState("generating");
    try {
      const res = await fetch("/api/exam/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: config.topic,
          length: config.length,
          cognitiveTarget: config.cognitiveTarget,
        }),
      });
      if (!res.ok) throw new Error("Failed to generate exam");
      const data: GeneratedExam = await res.json();
      setExam(data);
      setAnswers({});
      setState("taking");
    } catch (err: any) {
      toast.error(err.message || "Could not generate exam. Check your AI API key.");
      setState("config");
    }
  };

  const handleSubmit = async () => {
    if (!exam) return;
    const unanswered = exam.questions.filter((q) => !answers[q.id]?.trim());
    if (unanswered.length > 0) {
      toast.error(`Please answer all ${unanswered.length} remaining question(s).`);
      return;
    }

    setState("grading");
    try {
      const payload = exam.questions.map((q) => ({
        questionId: q.id,
        question: q.question,
        sampleAnswer: q.sampleAnswer,
        gradingCriteria: q.gradingCriteria,
        userAnswer: answers[q.id] || "",
        marks: q.marks,
      }));

      const res = await fetch("/api/exam/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });

      if (!res.ok) throw new Error("Failed to grade exam");
      const data = await res.json();
      setResults(data);
      setState("results");
    } catch (err: any) {
      toast.error(err.message || "Could not grade exam.");
      setState("taking");
    }
  };

  // ── CONFIG STATE ──────────────────────────────────────────────────────────
  if (state === "config") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-650">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-base font-bold text-slate-800">Custom AI Exam</h3>
            <p className="text-[10px] text-slate-500">
              AI generates a personalised mock paper instantly.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Target Topic
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none smooth-input transition-all"
              value={config.topic}
              onChange={(e) => setConfig((c) => ({ ...c, topic: e.target.value }))}
            >
              <option>Database Normalization (1NF, 2NF, 3NF)</option>
              <option>SQL Keys & Relational Schemas</option>
              <option>All Database Units (Comprehensive)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Exam Length
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none smooth-input transition-all"
              value={config.length}
              onChange={(e) => setConfig((c) => ({ ...c, length: e.target.value }))}
            >
              <option>Quick Check (15 mins / 20 pts)</option>
              <option>Standard Lab Practice (30 mins / 40 pts)</option>
              <option>Full Exam Mock (60 mins / 80 pts)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Cognitive Target
            </label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 outline-none smooth-input transition-all"
              value={config.cognitiveTarget}
              onChange={(e) => setConfig((c) => ({ ...c, cognitiveTarget: e.target.value }))}
            >
              <option>Conceptual Explanations (Essays)</option>
              <option>Practical Execution (DDL/DML SQL)</option>
              <option>Hybrid Exam Mock</option>
            </select>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 hover-lift active-press transition-all shadow-md shadow-blue-500/10"
        >
          <Sparkles className="h-4 w-4" />
          Generate Custom Paper
        </button>
      </div>
    );
  }

  // ── GENERATING STATE ──────────────────────────────────────────────────────
  if (state === "generating") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 flex flex-col items-center gap-4 text-center shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 animate-shimmer opacity-25 pointer-events-none" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-slate-100 bg-slate-50 shadow-sm">
          <Sparkles className="h-7 w-7 text-blue-600 animate-pulse" />
        </div>
        <div className="space-y-1 z-10">
          <h3 className="font-heading text-sm font-bold text-slate-800">Generating Your Exam Paper</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            AI is writing questions, rubrics, and model answers tailored to your settings...
          </p>
        </div>
      </div>
    );
  }

  // ── GRADING STATE ──────────────────────────────────────────────────────────
  if (state === "grading") {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 flex flex-col items-center gap-4 text-center shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 animate-shimmer opacity-25 pointer-events-none" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-slate-100 bg-slate-50 shadow-sm">
          <Loader2 className="h-7 w-7 text-amber-500 animate-spin" />
        </div>
        <div className="space-y-1 z-10">
          <h3 className="font-heading text-sm font-bold text-slate-800">AI is Marking Your Answers</h3>
          <p className="text-xs text-slate-500 max-w-sm">
            Each question is being graded concurrently against the rubric...
          </p>
        </div>
      </div>
    );
  }

  // ── RESULTS STATE ──────────────────────────────────────────────────────────
  if (state === "results" && results) {
    const { summary, results: qResults } = results;
    const gradeColors: Record<string, string> = {
      "A*": "text-purple-600",
      A: "text-emerald-600",
      B: "text-blue-600",
      C: "text-amber-655",
      D: "text-orange-600",
      U: "text-rose-600",
    };
    return (
      <div className="space-y-6">
        {/* Summary Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-blue-650" />
              <h3 className="font-heading text-base font-bold text-slate-800">Exam Results</h3>
            </div>
            <button
              onClick={() => { setExam(null); setResults(null); setState("config"); }}
              className="inline-flex items-center gap-1 rounded-full border border-slate-250 bg-white px-3 py-1 text-[10px] font-bold text-slate-655 hover:bg-slate-50 hover-lift active-press transition-all shadow-sm"
            >
              <ArrowLeft className="h-3 w-3" /> New Exam
            </button>
          </div>

          <div className="flex items-center justify-center gap-8 py-4">
            <div className="text-center space-y-1">
              <span className={cn("text-5xl font-heading font-black", gradeColors[summary.grade] || "text-slate-800")}>
                {summary.grade}
              </span>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Grade</p>
            </div>
            <div className="text-center space-y-1">
              <span className="text-5xl font-heading font-black text-slate-800">{summary.overallPercent}%</span>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Score</p>
            </div>
          </div>
        </div>

        {/* Per-question breakdown */}
        <div className="space-y-4">
          {qResults.map((q: any, idx: number) => (
            <div key={q.questionId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Question {idx + 1} — {q.maxMarks} marks
                  </p>
                  <p className="text-xs font-semibold text-slate-800">{q.question}</p>
                </div>
                <span className={cn(
                  "flex-shrink-0 font-heading text-base font-black",
                  q.earnedScore >= q.maxMarks * 0.7 ? "text-emerald-600" : q.earnedScore >= q.maxMarks * 0.5 ? "text-amber-600" : "text-rose-600"
                )}>
                  {q.earnedScore}/{q.maxMarks}
                </span>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                {q.feedback.rubricEvaluation?.map((r: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    {r.passed
                      ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                      : <XCircle className="mt-0.5 h-3.5 w-3.5 text-rose-600 flex-shrink-0" />
                    }
                    <div>
                      <span className="font-semibold text-slate-700">{r.criterion}: </span>
                      <span className="text-slate-500">{r.feedback}</span>
                    </div>
                  </div>
                ))}
              </div>

              {q.feedback.modelComparison && (
                <div className="rounded-xl border border-slate-150 bg-slate-50 p-3 text-[11px] text-slate-600">
                  <span className="font-bold text-slate-700">Comparison: </span>{q.feedback.modelComparison}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── TAKING STATE ──────────────────────────────────────────────────────────
  if (state === "taking" && exam) {
    return (
      <div className="space-y-6">
        {/* Exam Header */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-base font-bold text-slate-800">{exam.examTitle}</h2>
            <button
              onClick={() => setState("config")}
              className="inline-flex items-center gap-1 rounded-full border border-slate-250 bg-white px-3 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-50 hover-lift active-press transition-all shadow-sm"
            >
              <ArrowLeft className="h-3 w-3" /> Cancel
            </button>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {exam.duration}</span>
            <span>• {exam.totalMarks} Total Marks</span>
            <span>• {exam.questions.length} Questions</span>
          </div>
        </div>

        {/* Questions */}
        {exam.questions.map((q, idx) => (
          <div key={q.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-0.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Question {idx + 1}
                </p>
                <p className="text-sm font-semibold text-slate-800">{q.question}</p>
              </div>
              <span className="flex-shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[9px] font-bold text-slate-650">
                [{q.marks} marks]
              </span>
            </div>

            <textarea
              rows={4}
              placeholder="Write your answer here..."
              value={answers[q.id] || ""}
              onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-800 placeholder:text-slate-400 outline-none smooth-input resize-none transition-all"
            />
          </div>
        ))}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-full bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 hover-lift active-press transition-all shadow-md shadow-blue-500/10"
        >
          <Send className="h-3.5 w-3.5" />
          Submit Exam for AI Grading
        </button>
      </div>
    );
  }

  return null;
}
