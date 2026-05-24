"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, AlertCircle, Database, Cpu, Bot, Layers, Sparkles } from "lucide-react";

interface LoadingNewLessonProps {
  lessonId: string;
  onComplete?: () => void;
}

export function LoadingNewLesson({ lessonId, onComplete }: LoadingNewLessonProps) {
  const [status, setStatus] = useState<"processing" | "failed" | "placeholder" | "published" | "loading">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Steps to show progress
  const steps = [
    {
      title: "Data Ingested",
      description: "Aggregated Teams context received and verified.",
      icon: Database,
    },
    {
      title: "Analyzing Teams Context",
      description: "Creating initial structured layout based on raw logs.",
      icon: Cpu,
    },
    {
      title: "AI Self-Correction Loop Active (1-Hour Window)",
      description: "Gemini reviewing draft, addressing omissions, and refining structure.",
      icon: Bot,
    },
    {
      title: "Structuring Deep Recall Memory",
      description: "Extracting microscopic recall nodes and generating embeddings.",
      icon: Layers,
    },
  ];

  // Animate the loading steps while database is processing
  useEffect(() => {
    if (status !== "processing") return;

    const intervals = [3000, 6000, 15000]; // timing transitions for steps
    const timers: NodeJS.Timeout[] = [];

    timers.push(
      setTimeout(() => {
        setCurrentStep(1);
      }, intervals[0])
    );

    timers.push(
      setTimeout(() => {
        setCurrentStep(2);
      }, intervals[1])
    );

    timers.push(
      setTimeout(() => {
        setCurrentStep(3);
      }, intervals[2])
    );

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [status]);

  // Polling database for lesson status
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/lessons?id=${lessonId}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch: ${res.statusText}`);
        }
        const data = await res.json();
        if (!active) return;

        if (data.success && data.lesson) {
          const lessonStatus = data.lesson.status;
          setStatus(lessonStatus);

          if (lessonStatus === "placeholder" || lessonStatus === "published") {
            setCurrentStep(4); // Mark all steps complete
            if (onComplete) {
              // Give a small delay for user to see the success state
              setTimeout(() => {
                if (active) onComplete();
              }, 1500);
            }
          } else if (lessonStatus === "failed") {
            setErrorMsg("Recall pipeline processing failed.");
          }
        }
      } catch (err: any) {
        console.error("Error polling lesson status:", err);
        if (active) {
          setErrorMsg(err.message || "Failed to communicate with the server");
          setStatus("failed");
        }
      }
    };

    poll(); // initial check
    const interval = setInterval(poll, 4000); // Poll every 4 seconds for responsiveness

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [lessonId, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 max-w-3xl mx-auto">
      <div className="w-full bg-card/60 backdrop-blur-xl border border-border/80 rounded-2xl p-8 shadow-2xl relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-8 pb-6 border-b border-border/50">
            <div>
              <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent">
                Recall Pipeline Active
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ingested lesson is undergoing multi-stage agentic synthesis and embedding generation.
              </p>
            </div>
            {status === "processing" || status === "loading" ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processing
              </div>
            ) : status === "failed" ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-xs font-semibold text-destructive">
                <AlertCircle className="w-3.5 h-3.5" />
                Failed
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Completed
              </div>
            )}
          </div>

          {status === "failed" ? (
            <div className="p-6 rounded-xl bg-destructive/5 border border-destructive/20 text-center">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
              <h3 className="font-semibold text-lg text-foreground mb-2">Synthesis Failed</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mb-6">
                {errorMsg || "An error occurred during drafting, self-correction, or deep recall node extraction."}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-all rounded-md bg-secondary hover:bg-secondary/80 border border-border"
              >
                Retry Request
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Progress Steps */}
              <div className="grid gap-6">
                {steps.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isCompleted = idx < currentStep;
                  const isActive = idx === currentStep;

                  return (
                    <div
                      key={step.title}
                      className={`flex items-start gap-4 p-4 rounded-xl border transition-all duration-300 ${
                        isActive
                          ? "bg-primary/5 border-primary/30 shadow-[0_0_15px_rgba(var(--primary-rgb),0.05)]"
                          : isCompleted
                          ? "bg-muted/10 border-border/40 opacity-70"
                          : "bg-transparent border-transparent opacity-40"
                      }`}
                    >
                      <div className="relative mt-1">
                        {isCompleted ? (
                          <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        ) : isActive ? (
                          <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary flex items-center justify-center text-primary relative">
                            <StepIcon className="w-4 h-4" />
                            <div className="absolute inset-0 rounded-full border border-primary animate-ping opacity-60" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground">
                            <StepIcon className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4
                            className={`font-semibold text-sm transition-colors ${
                              isActive ? "text-primary" : "text-foreground"
                            }`}
                          >
                            {step.title}
                          </h4>
                          {isActive && (
                            <span className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wider">
                              <Sparkles className="w-2.5 h-2.5 animate-spin duration-1000" />
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Progress Bar */}
              <div className="pt-6 border-t border-border/40 space-y-3">
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden relative">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-1000 ease-out"
                    style={{ width: `${Math.min(100, Math.max(15, (currentStep + 1) * 25))}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                  <span>Processing status: {status === "loading" ? "Initializing..." : "Running Agentic Loop"}</span>
                  <span>Step {Math.min(4, currentStep + 1)} of 4</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
