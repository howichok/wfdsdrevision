"use client";

import { useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  X,
  Send,
  Loader2,
  Award,
  Sparkles,
  ListTodo,
  TrendingUp,
  RotateCcw,
  BookOpenCheck,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TopicWorkspaceClientProps {
  topic: { id: string; title: string; description: string | null };
  questions: any[];
  initialSubmissions: any[];
}

export function TopicWorkspaceClient({
  topic,
  questions,
  initialSubmissions,
}: TopicWorkspaceClientProps) {
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [activeTab, setActiveTab] = useState<"write" | "feedback" | "history">("write");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pollingSubmissionId, setPollingSubmissionId] = useState<string | null>(null);

  const activeQuestion = questions[activeQuestionIndex];

  // Get active question's latest submission
  const latestSubmission = submissions.find(
    (s) => s.questionId === activeQuestion?.id
  );

  // Initialize Tiptap editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Type your academic answer here...",
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "prose focus:outline-none min-h-[250px] max-w-none text-sm p-4 leading-relaxed text-slate-800 bg-white",
      },
    },
  });

  // Load latest submission content into editor if available and they want to revise
  useEffect(() => {
    if (editor && latestSubmission && latestSubmission.status !== "marked") {
      editor.commands.setContent(latestSubmission.userAnswer);
    } else if (editor) {
      editor.commands.setContent("");
    }
  }, [activeQuestionIndex, editor]);

  // Polling for AI feedback
  useEffect(() => {
    if (!pollingSubmissionId) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        // Stop after 60 seconds
        clearInterval(interval);
        setPollingSubmissionId(null);
        setIsSubmitting(false);
        toast.error("AI grading timed out. Please refresh the page.");
        return;
      }

      try {
        const res = await fetch(`/api/submissions/${pollingSubmissionId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();

        if (data.status === "marked") {
          clearInterval(interval);
          setPollingSubmissionId(null);
          setIsSubmitting(false);

          // Update local submissions list
          setSubmissions((prev) =>
            prev.map((s) => (s.id === pollingSubmissionId ? { ...s, ...data } : s))
          );
          setActiveTab("feedback");
          toast.success("AI grading complete! Open 'AI Feedback' tab.");
        } else if (data.status === "failed") {
          clearInterval(interval);
          setPollingSubmissionId(null);
          setIsSubmitting(false);
          toast.error("AI grading failed. Please retry.");
        }
      } catch (err) {
        console.error("Error polling submission:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [pollingSubmissionId]);

  if (!activeQuestion) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        No questions generated for this topic yet.
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!editor || !editor.getText().trim()) {
      toast.error("Please type your answer before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: activeQuestion.id,
          userAnswer: editor.getHTML(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit answer");

      // Prepend pending submission to list
      const tempSub = {
        id: data.submissionId,
        questionId: activeQuestion.id,
        userAnswer: editor.getHTML(),
        status: "pending",
        score: null,
        feedback: null,
        createdAt: new Date().toISOString(),
      };

      setSubmissions((prev) => [tempSub, ...prev]);
      setPollingSubmissionId(data.submissionId);
      setActiveTab("feedback");
      toast.info("Answer submitted! AI is grading your attempt...");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
      setIsSubmitting(false);
    }
  };

  const activeQuestionSubmissions = submissions.filter(
    (s) => s.questionId === activeQuestion.id
  );

  const fb = latestSubmission?.feedback as any;

  return (
    <div className="flex flex-col xl:flex-row gap-6 items-stretch min-h-[calc(100vh-10rem)]">
      {/* Left Column: Questions drawer */}
      <div className="w-full xl:w-80 flex-shrink-0 flex flex-col gap-4">
        {/* Topic Title card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
          <h2 className="font-heading text-base font-bold text-slate-800">{topic.title}</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {topic.description}
          </p>
        </div>

        {/* Questions selector */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex-1 flex flex-col gap-2.5">
          <div className="flex items-center gap-1 px-1 border-b border-slate-100 pb-3">
            <ListTodo className="h-4 w-4 text-slate-500" />
            <h3 className="font-heading text-xs font-semibold uppercase tracking-wider text-slate-500">
              Questions Checklist
            </h3>
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] xl:max-h-none pr-1">
            {questions.map((q, idx) => {
              const solved = submissions.some(
                (s) => s.questionId === q.id && s.status === "marked"
              );
              const active = idx === activeQuestionIndex;

              return (
                <button
                  key={q.id}
                  onClick={() => {
                    setActiveQuestionIndex(idx);
                    setActiveTab("write");
                  }}
                  className={cn(
                    "w-full text-left rounded-xl border transition-all text-xs space-y-2 p-3 hover-lift active-press",
                    active
                      ? "bg-blue-50 border-blue-500 text-slate-800 font-semibold shadow-sm"
                      : "border-slate-200 bg-white hover:bg-slate-50 text-slate-650 hover:text-slate-800"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="font-semibold line-clamp-2 leading-snug">{q.title}</span>
                    {solved ? (
                      <span className="flex-shrink-0 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : (
                      <span className="flex-shrink-0 h-2 w-2 rounded-full bg-slate-300 mt-1.5" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span
                      className={cn(
                        "font-bold uppercase tracking-wider rounded-full px-2 py-0.5 border text-[9px]",
                        q.difficulty === "easy"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : q.difficulty === "medium"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-rose-200 bg-rose-50 text-rose-700"
                      )}
                    >
                      {q.difficulty}
                    </span>
                    <span className="text-slate-450">Type: {q.type}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Working workspace */}
      <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden min-h-[500px]">
        {/* Workspace Tab headers */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 h-12">
          <div className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab("write")}
              className={cn(
                "relative flex h-12 items-center text-xs font-bold transition-all border-b-2 border-transparent",
                activeTab === "write" ? "text-blue-600 border-blue-600" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Write Response
            </button>
            <button
              onClick={() => setActiveTab("feedback")}
              className={cn(
                "relative flex h-12 items-center text-xs font-bold transition-all border-b-2 border-transparent",
                activeTab === "feedback" ? "text-blue-600 border-blue-600" : "text-slate-500 hover:text-slate-800"
              )}
            >
              AI Feedback
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "relative flex h-12 items-center text-xs font-bold transition-all border-b-2 border-transparent",
                activeTab === "history" ? "text-blue-600 border-blue-600" : "text-slate-500 hover:text-slate-800"
              )}
            >
              Submission History ({activeQuestionSubmissions.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={activeQuestionIndex === 0}
              onClick={() => {
                setActiveQuestionIndex((prev) => prev - 1);
                setActiveTab("write");
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-250 bg-white text-slate-650 hover:bg-slate-50 disabled:opacity-35 hover-lift active-press shadow-sm"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              disabled={activeQuestionIndex === questions.length - 1}
              onClick={() => {
                setActiveQuestionIndex((prev) => prev + 1);
                setActiveTab("write");
              }}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-slate-250 bg-white text-slate-650 hover:bg-slate-50 disabled:opacity-35 hover-lift active-press shadow-sm"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tab 1: Write Response */}
        {activeTab === "write" && (
          <div className="flex-1 flex flex-col p-6 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-2">
              <h3 className="font-heading text-sm font-bold text-slate-800">{activeQuestion.title}</h3>
              <p className="text-xs leading-relaxed text-slate-600">{activeQuestion.text}</p>
            </div>

            {/* Rich Editor container */}
            <div className="flex-1 flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden min-h-[250px]">
              {editor && (
                <div className="flex items-center gap-1 border-b border-slate-200 bg-slate-50 px-4 py-1.5 text-xs">
                  <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={cn(
                      "px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-bold hover-lift active-press",
                      editor.isActive("bold") && "bg-slate-100 text-slate-900 border-slate-300"
                    )}
                  >
                    B
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={cn(
                      "px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 italic hover-lift active-press",
                      editor.isActive("italic") && "bg-slate-100 text-slate-900 border-slate-300"
                    )}
                  >
                    I
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={cn(
                      "px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover-lift active-press",
                      editor.isActive("bulletList") && "bg-slate-100 text-slate-900 border-slate-300"
                    )}
                  >
                    Bullets
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={cn(
                      "px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover-lift active-press",
                      editor.isActive("orderedList") && "bg-slate-100 text-slate-900 border-slate-300"
                    )}
                  >
                    Numbers
                  </button>
                  <button
                    onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                    className={cn(
                      "px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 font-mono hover-lift active-press",
                      editor.isActive("codeBlock") && "bg-slate-100 text-slate-900 border-slate-300"
                    )}
                  >
                    &lt;/&gt;
                  </button>
                </div>
              )}
              <EditorContent editor={editor} className="flex-1 overflow-y-auto max-h-[350px]" />
            </div>

            <div className="flex justify-end gap-3">
              {latestSubmission && latestSubmission.status === "marked" && (
                <button
                  onClick={() => {
                    editor?.commands.setContent("");
                    toast.success("Editor reset! You can submit a new attempt.");
                  }}
                  className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-slate-250 bg-white px-4 text-xs font-semibold text-slate-650 hover:bg-slate-50 hover-lift active-press transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Re-attempt
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-blue-600 px-5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 hover-lift active-press transition-all shadow-md shadow-blue-500/10"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" /> Submit for AI Grading
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: AI Feedback */}
        {activeTab === "feedback" && (
          <div className="flex-1 p-6 overflow-y-auto max-h-[600px]">
            {isSubmitting ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4 text-center">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                <div className="space-y-1">
                  <p className="font-heading text-sm font-bold text-slate-800">AI Grading in Progress</p>
                  <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                    Gemini is assessing your answer against rubrics, evaluating strengths, and preparing perfect response comparisons.
                  </p>
                </div>
              </div>
            ) : latestSubmission ? (
              latestSubmission.status === "pending" ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4 text-center">
                  <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                  <p className="text-xs text-slate-500 font-semibold">Syncing evaluation. Checking grading queue...</p>
                </div>
              ) : fb ? (
                <div className="space-y-8">
                  {/* Score header */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                    <div className="space-y-1.5 text-center sm:text-left">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600">
                        <Award className="h-4 w-4" />
                        <span>AI EVALUATION COMPLETE</span>
                      </div>
                      <h4 className="font-heading text-base font-bold text-slate-800">
                        Great attempt! Grade assigned.
                      </h4>
                      <p className="text-xs text-slate-400">
                        Graded on {new Date(latestSubmission.markedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-3xl font-extrabold tracking-tight text-blue-600">
                          {fb.score}%
                        </p>
                        <p className="text-[10px] text-slate-500 uppercase font-semibold">
                          Grade {fb.grade}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Rubric Criteria Grid */}
                  <div className="space-y-3">
                    <h4 className="font-heading text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                      <BookOpenCheck className="h-4 w-4 text-slate-400" />
                      Rubric Breakdown
                    </h4>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {fb.rubricEvaluation?.map((rub: any, index: number) => (
                        <div
                          key={index}
                          className={cn(
                            "rounded-2xl border p-5 space-y-1.5 text-xs flex flex-col justify-between",
                            rub.passed
                              ? "border-emerald-200 bg-emerald-50/50"
                              : "border-rose-200 bg-rose-50/50"
                          )}
                        >
                          <div className="flex items-start justify-between gap-4 font-semibold">
                            <span className={rub.passed ? "text-emerald-700" : "text-rose-700"}>
                              {rub.criterion}
                            </span>
                            {rub.passed ? (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                                <Check className="h-3 w-3" />
                              </span>
                            ) : (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                                <X className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                          <p className="text-slate-500 leading-relaxed">{rub.feedback}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Strengths & Improvements */}
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-3">
                      <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-emerald-700">
                        Top Strengths
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-650 list-disc pl-4 leading-relaxed">
                        {fb.strengths?.map((str: string, index: number) => (
                          <li key={index}>{str}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 space-y-3">
                      <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-rose-700">
                        Areas of Improvement
                      </h4>
                      <ul className="space-y-2 text-xs text-slate-655 list-disc pl-4 leading-relaxed">
                        {fb.improvements?.map((imp: string, index: number) => (
                          <li key={index}>{imp}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Model comparison */}
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 space-y-3 text-xs">
                    <h4 className="font-heading font-bold text-slate-700">Model Comparison</h4>
                    <p className="text-slate-600 leading-relaxed">{fb.modelComparison}</p>
                  </div>

                  {/* Perfect rewrite answer */}
                  <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-5 space-y-3 text-xs">
                    <h4 className="font-heading font-bold text-blue-800 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" />
                      Refined Model Answer
                    </h4>
                    <div
                      className="text-slate-700 leading-relaxed prose prose-xs"
                      dangerouslySetInnerHTML={{ __html: fb.refinedAnswer }}
                    />
                  </div>
                </div>
              ) : (
                <div className="py-20 text-center text-slate-550 text-sm">
                  Grading details failed to retrieve.
                </div>
              )
            ) : (
              <div className="py-20 text-center text-slate-450 text-sm">
                No attempt submitted yet. Type your answer and click 'Submit for AI Grading'.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Submission History */}
        {activeTab === "history" && (
          <div className="flex-1 p-6 overflow-y-auto max-h-[600px] space-y-4">
            {activeQuestionSubmissions.length > 0 ? (
              <div className="divide-y divide-slate-100">
                {activeQuestionSubmissions.map((sub) => (
                  <div key={sub.id} className="py-4 first:pt-0 last:pb-0 flex items-center justify-between text-xs">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-700">
                        Submitted: {new Date(sub.createdAt).toLocaleString()}
                      </p>
                      <p className="text-slate-450">Status: {sub.status}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {sub.status === "marked" && (
                        <span className="font-bold text-blue-600 text-sm">{sub.score}%</span>
                      )}
                      <button
                        onClick={() => {
                          // Force set this submission as the active latest one to view feedback
                          setSubmissions((prev) => {
                            const without = prev.filter((s) => s.id !== sub.id);
                            return [sub, ...without];
                          });
                          setActiveTab("feedback");
                        }}
                        className="inline-flex h-7 items-center justify-center rounded-full border border-slate-250 bg-white px-3.5 text-[10px] font-bold text-slate-650 hover:bg-slate-50 hover-lift active-press transition-all shadow-sm"
                      >
                        View feedback
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-sm">
                No previous attempts recorded for this question.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
