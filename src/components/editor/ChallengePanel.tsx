"use client";

import React, { useState, useEffect } from "react";
import {
  Code2,
  Terminal,
  CheckCircle,
  XCircle,
  Play,
  RefreshCw,
  AlertCircle,
  FileCode,
  GraduationCap
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { evaluatePythonChallenge, evaluateNodeChallenge } from "@/lib/sandboxes/evaluator";
import { submitChallengeAction } from "@/app/actions/lessons";
import { saveChallengeSubmissionLocal, getLessonsDb } from "@/lib/db/dexie-store";

interface TestSuiteItem {
  input: string;
  expectedOutput: string;
  hiddenAssertionScript?: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  language: "python" | "javascript" | string;
  starterCode: string;
  testSuite: TestSuiteItem[] | any;
}

interface ChallengePanelProps {
  challenges: Challenge[];
  lessonId: string;
  onCodeChange?: (code: string) => void;
  onErrorChange?: (error: string | null) => void;
  userId: string;
}

export function ChallengePanel({
  challenges,
  lessonId,
  onCodeChange,
  onErrorChange,
  userId,
}: ChallengePanelProps) {
  const [activeTab, setActiveTab] = useState<"instructions" | "tests">("instructions");
  const [selectedChallengeIndex, setSelectedChallengeIndex] = useState(0);
  const [userCodes, setUserCodes] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [evaluationResults, setEvaluationResults] = useState<any[] | null>(null);
  const [evaluationError, setEvaluationError] = useState<string | null>(null);

  const activeChallenge = challenges[selectedChallengeIndex];

  // Initialize editor contents with starterCode
  useEffect(() => {
    if (!activeChallenge) return;
    const initialCode = userCodes[activeChallenge.id] !== undefined
      ? userCodes[activeChallenge.id]
      : activeChallenge.starterCode;

    if (userCodes[activeChallenge.id] === undefined) {
      setUserCodes((prev) => ({
        ...prev,
        [activeChallenge.id]: activeChallenge.starterCode,
      }));
    }
    
    // Notify parent of current challenge code and clear error state
    onCodeChange?.(initialCode);
    setEvaluationResults(null);
    setEvaluationError(null);
    onErrorChange?.(null);
    setActiveTab("instructions");
  }, [selectedChallengeIndex, activeChallenge]);

  if (!activeChallenge) {
    return (
      <div className="rounded-2xl border border-white/5 bg-slate-900/10 p-6 text-center select-none">
        <GraduationCap className="h-8 w-8 text-slate-500 mx-auto mb-2.5 animate-pulse" />
        <p className="text-xs text-slate-400 font-medium">
          No programming challenges found for this lesson yet.
        </p>
      </div>
    );
  }

  const currentCode = userCodes[activeChallenge.id] || activeChallenge.starterCode;

  // Custom key listener for indents inside code textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const val = textarea.value;
      const newVal = val.substring(0, start) + "  " + val.substring(end);

      setUserCodes((prev) => ({
        ...prev,
        [activeChallenge.id]: newVal,
      }));
      onCodeChange?.(newVal);

      // Set cursor position back
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleResetCode = () => {
    if (confirm("Are you sure you want to reset the editor code to the default starter stub?")) {
      setUserCodes((prev) => ({
        ...prev,
        [activeChallenge.id]: activeChallenge.starterCode,
      }));
      onCodeChange?.(activeChallenge.starterCode);
      onErrorChange?.(null);
      toast.info("Editor code reset successfully.");
    }
  };

  const handleVerify = async () => {
    setIsRunning(true);
    setEvaluationResults(null);
    setEvaluationError(null);
    setActiveTab("tests");

    const codeToRun = userCodes[activeChallenge.id] || activeChallenge.starterCode;
    let rawSuite = activeChallenge.testSuite;
    let suite: TestSuiteItem[] = [];

    try {
      if (typeof rawSuite === "string") {
        suite = JSON.parse(rawSuite);
      } else if (Array.isArray(rawSuite)) {
        suite = rawSuite;
      }
    } catch (e) {
      toast.error("Failed to parse the challenge test suite.");
      setIsRunning(false);
      return;
    }

    try {
      let outcome;
      if (activeChallenge.language === "python") {
        outcome = await evaluatePythonChallenge(codeToRun, suite, activeChallenge.starterCode);
      } else {
        outcome = await evaluateNodeChallenge(codeToRun, suite, activeChallenge.starterCode);
      }

      setEvaluationResults(outcome.results);

      // Save locally first (offline-first)
      const status = outcome.success ? "passed" : "failed";
      const localRes = await saveChallengeSubmissionLocal(userId, activeChallenge.id, codeToRun, status);

      // Persist results back to Supabase/PostgreSQL via Server Action
      const syncResult = await submitChallengeAction(activeChallenge.id, codeToRun, status);

      if (syncResult && syncResult.success && localRes.success && localRes.id) {
        const db = getLessonsDb();
        await db.submissions.update(localRes.id, { synced: 1 });
      }

      if (outcome.success) {
        toast.success("Congratulations! All test assertions passed successfully.");
        onErrorChange?.(null);
      } else {
        toast.warning("Verification failed. Check test case outputs for details.");
        // Format failing tests for the Copilot
        const failingTests = outcome.results
          .filter((r) => !r.success)
          .map((r, idx) => `Test Case #${idx + 1} Failed.\nInput: ${r.input}\nExpected: ${r.expected}\nActual: ${r.actual}`)
          .join("\n\n");
        onErrorChange?.(failingTests);
      }

      if (syncResult && !syncResult.success) {
        console.warn("[ChallengePanel] Failed to sync progress to cloud database:", syncResult.error);
        toast.info("Progress saved locally (Database offline).");
      }
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || String(err);
      setEvaluationError(errMsg);
      toast.error("Execution error: " + errMsg);
      onErrorChange?.(`Execution Error:\n${errMsg}`);
      
      // Save failed completion state even on runtime crashes
      const localRes = await saveChallengeSubmissionLocal(userId, activeChallenge.id, codeToRun, "failed");
      const syncResult = await submitChallengeAction(activeChallenge.id, codeToRun, "failed");
      if (syncResult && syncResult.success && localRes.success && localRes.id) {
        const db = getLessonsDb();
        await db.submissions.update(localRes.id, { synced: 1 });
      }
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/30 shadow-2xl backdrop-blur-lg overflow-hidden mt-6">
      {/* Header controls & tabs switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 bg-slate-950/60 p-4 gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-purple-950/50 border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Code2 className="h-4.5 w-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Coding Challenge: {activeChallenge.title}
              <span className="rounded-md bg-purple-950/40 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                {activeChallenge.language}
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">
              Run assertions dynamically inside the client-side sandboxed runtime.
            </p>
          </div>
        </div>

        {/* Switcher if multiple challenges exist */}
        {challenges.length > 1 && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Select Challenge:
            </label>
            <select
              value={selectedChallengeIndex}
              onChange={(e) => setSelectedChallengeIndex(Number(e.target.value))}
              className="rounded-lg border border-white/10 bg-slate-900 px-2 py-1 text-xs text-slate-200 outline-none focus:border-purple-500/40"
            >
              {challenges.map((ch, idx) => (
                <option key={ch.id} value={idx}>
                  {idx + 1}. {ch.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs list */}
      <div className="flex items-center justify-between border-b border-white/5 bg-slate-900/20 px-4 py-2 gap-2">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab("instructions")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all hover-lift active-press cursor-pointer ${
              activeTab === "instructions"
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            Instructions & Editor
          </button>
          <button
            onClick={() => setActiveTab("tests")}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all hover-lift active-press cursor-pointer flex items-center gap-1.5 ${
              activeTab === "tests"
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            Test Cases
            {evaluationResults && (
              <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetCode}
            disabled={isRunning}
            className="p-2 rounded-full text-slate-400 hover:bg-white/5 hover:text-white hover-lift active-press transition-all disabled:opacity-40 cursor-pointer"
            title="Reset code editor stub"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body Canvas based on active tab */}
      <div className="grid grid-cols-1 md:grid-cols-2 min-h-[380px] bg-slate-950/20">
        {/* Left Hand: Instructions & metadata / Results (depending on tab) */}
        <div className="border-r border-white/5 p-4 overflow-y-auto max-h-[420px]">
          {activeTab === "instructions" ? (
            <div className="prose prose-invert max-w-none text-slate-300 text-xs leading-relaxed space-y-4">
              <h4 className="text-slate-100 font-bold uppercase tracking-wider text-[11px]">
                Problem Description
              </h4>
              <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4.5 text-slate-300 font-normal space-y-2">
                <ReactMarkdown>{activeChallenge.description}</ReactMarkdown>
              </div>

              <h4 className="text-slate-100 font-bold uppercase tracking-wider text-[11px] pt-1">
                Environment Notes
              </h4>
              <ul className="space-y-1.5 text-slate-400 list-disc list-inside pl-0.5">
                <li>Pyodide WASM isolates local runs safely in a sub-thread.</li>
                <li>StackBlitz WebContainers spin up internal virtual servers.</li>
                <li>Run validations locally without sending code to remote APIs.</li>
              </ul>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-slate-100 font-bold uppercase tracking-wider text-[11px]">
                Evaluation Outputs
              </h4>

              {isRunning ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <RefreshCw className="h-6 w-6 animate-spin text-purple-400" />
                  <p className="text-xs text-slate-400 animate-pulse font-medium">
                    Initializing runtime sandbox & executing test cases...
                  </p>
                </div>
              ) : evaluationError ? (
                <div className="rounded-2xl border border-red-500/25 bg-red-950/15 p-4 flex gap-3 text-red-400">
                  <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
                  <div className="space-y-1 text-xs">
                    <p className="font-bold">Execution Failed</p>
                    <pre className="text-[10px] font-mono leading-normal bg-red-950/20 border border-red-500/10 p-2 rounded-xl max-w-full overflow-x-auto whitespace-pre-wrap">
                      {evaluationError}
                    </pre>
                  </div>
                </div>
              ) : evaluationResults ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Test Case Summary
                    </span>
                    <span className="text-xs font-bold text-slate-200">
                      {evaluationResults.filter((r) => r.success).length} / {evaluationResults.length} Passed
                    </span>
                  </div>

                  <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                    {evaluationResults.map((res, i) => (
                      <div
                        key={i}
                        className={`rounded-2xl border p-4 flex flex-col gap-2 transition-all ${
                          res.success
                            ? "bg-emerald-950/10 border-emerald-500/20 text-emerald-400"
                            : "bg-rose-950/10 border-rose-500/20 text-rose-400"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                            {res.success ? (
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-rose-400" />
                            )}
                            Test Case #{i + 1}
                          </span>
                          <span className="text-[10px] font-medium opacity-80">
                            {res.success ? "Passed" : "Failed"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 gap-1.5 font-mono text-[10px] leading-relaxed border-t border-white/5 pt-2">
                          <div>
                            <span className="text-slate-400">Input:</span>{" "}
                            <span className="text-slate-200">{res.input}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Expected:</span>{" "}
                            <span className="text-slate-200">{res.expected}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Actual:</span>{" "}
                            <span
                              className={res.success ? "text-emerald-300" : "text-rose-300"}
                            >
                              {res.actual}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center select-none">
                  <Terminal className="h-8 w-8 text-slate-500 mb-2" />
                  <p className="text-xs text-slate-400">
                    No run logs yet. Click "Submit & Verify" to test your code.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Hand: Code Editor Workspace */}
        <div className="flex flex-col bg-slate-950/40 relative">
          <div className="flex items-center justify-between border-b border-white/5 bg-slate-950/50 px-4 py-2 select-none">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5 text-purple-400" />
              Editor Workspace
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              Tab key indents by 2 spaces
            </span>
          </div>

          <div className="relative flex-1 min-h-[300px] flex flex-col font-mono text-xs">
            <textarea
              value={currentCode}
              onChange={(e) => {
                const val = e.target.value;
                setUserCodes((prev) => ({
                  ...prev,
                  [activeChallenge.id]: val,
                }));
                onCodeChange?.(val);
              }}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              disabled={isRunning}
              className="w-full flex-1 resize-none bg-transparent p-4 text-slate-200 outline-none leading-relaxed font-mono focus:ring-0 focus:border-0 smooth-input"
              style={{ tabSize: 2 }}
              placeholder="# Write your program here..."
            />
          </div>
        </div>
      </div>

      {/* Footer Run Bar */}
      <div className="flex items-center justify-between border-t border-white/10 bg-slate-950/60 p-4 select-none">
        <p className="text-[10px] text-slate-400">
          Make sure your function signature matches the expected starter signature stub.
        </p>

        <button
          onClick={handleVerify}
          disabled={isRunning}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-purple-600 hover:bg-purple-500 px-4 text-xs font-bold text-white hover-lift active-press transition-all disabled:opacity-50 select-none shadow-lg shadow-purple-900/10 cursor-pointer"
        >
          {isRunning ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              Submit & Verify
            </>
          )}
        </button>
      </div>
    </div>
  );
}
