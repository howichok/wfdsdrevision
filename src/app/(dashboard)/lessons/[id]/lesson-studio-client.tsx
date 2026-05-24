"use client";

import React, { useState, useEffect, useRef } from "react";
import { useLessonDraft, getLessonsDb, syncLocalChangesToCloud } from "@/lib/db/dexie-store";
import { LessonEditor } from "@/components/editor/LessonEditor";
import { toast } from "sonner";
import {
  ListChecks,
  HelpCircle,
  GraduationCap,
  Sparkles,
  BookOpen,
  X,
  Download,
  FileText,
  Loader2
} from "lucide-react";
import { LoadingNewLesson } from "@/components/ui/LoadingNewLesson";
import { ChallengePanel } from "@/components/editor/ChallengePanel";
import { CopilotSidebar } from "@/components/editor/CopilotSidebar";
import { useQuery } from "@tanstack/react-query";
import { getLessonsHistoryAction, publishLessonAction } from "@/app/actions/lessons";
import { useAppStore } from "@/store/app.store";
import { DraftSavedIndicator, useDraftAutoSaver } from "@/components/editor/DraftAutoSaver";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

interface LessonStudioClientProps {
  lessonId: string;
  initialLesson: any;
  challenges?: any[];
  userId: string;
  canPublish?: boolean;
}

export function LessonStudioClient({
  lessonId,
  initialLesson,
  challenges = [],
  userId,
  canPublish = false,
}: LessonStudioClientProps) {
  const { draft, isLoading, reloadDraft } = useLessonDraft(lessonId, initialLesson, userId);
  const [currentCode, setCurrentCode] = useState<string>("");
  const [lastErrorLog, setLastErrorLog] = useState<string | null>(null);
  const [isRightPaneOpen, setIsRightPaneOpen] = useState<boolean>(true);
  const [rightPaneView, setRightPaneView] = useState<"syllabus" | "copilot">("syllabus");
  // Live Tiptap editor ref — populated once LessonEditor mounts its editor instance
  const editorRef = useRef<import('@tiptap/react').Editor | null>(null);

  const [importing, setImporting] = useState<Record<string, boolean>>({});
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const result = await publishLessonAction(lessonId);
      if (!result.success) throw new Error(result.error || "Publish failed");
      toast.success("Lesson published for students!");
      await reloadDraft();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not publish lesson";
      toast.error(message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleImport = async (fileName: string) => {
    setImporting((prev) => ({ ...prev, [fileName]: true }));
    try {
      const res = await fetch("/api/lessons/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to import");

      toast.success(data.message || "Material successfully imported to Revision Hub!");
    } catch (err: any) {
      toast.error(err.message || "Could not parse attachment.");
    } finally {
      setImporting((prev) => ({ ...prev, [fileName]: false }));
    }
  };

  const isExamMode = useAppStore((s) => s.isExamMode);
  const clearWorkspaceDraft = useWorkspaceStore((s) => s.clearDraft);

  // Force syllabus view and prevent opening AI chat in exam mode
  useEffect(() => {
    if (isExamMode) {
      setRightPaneView("syllabus");
    }
  }, [isExamMode]);

  // Workspace auto-saver — debounces Tiptap + sandbox changes into the store
  useDraftAutoSaver({
    id: lessonId,
    title: draft?.title || initialLesson?.title || "Lesson Draft",
    editor: editorRef.current,
    sandboxCode: currentCode ? { main: currentCode } : {},
    currentTab: rightPaneView === "copilot" ? "tutor" : "editor",
  });

  // 1. Fetch lesson history in background to seed local IndexedDB cache
  const { data: historyData } = useQuery({
    queryKey: ["lessons-history", userId],
    queryFn: async () => {
      const res = await getLessonsHistoryAction(userId);
      if (!res.success) throw new Error(res.error || "Failed to fetch history");
      return res.lessons;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes cache
  });

  // Seed Dexie database with history when retrieved
  useEffect(() => {
    if (!historyData || typeof window === "undefined") return;

    const seedHistory = async () => {
      try {
        const db = getLessonsDb();
        for (const lesson of historyData) {
          const local = await db.drafts.get(lesson.id);
          if (!local) {
            await db.drafts.put({
              id: lesson.id,
              userId: userId,
              title: lesson.title,
              content: lesson.content,
              structuredContent: (lesson.structuredContent as any) || {
                title: lesson.title,
                objectives: [],
                concepts: [],
                editorPlaceholder: { type: "doc", content: [] },
              },
              status: lesson.status,
              synced: 1,
              updatedAt: lesson.updatedAt ? new Date(lesson.updatedAt).getTime() : Date.now(),
            });
          }
        }
      } catch (err) {
        console.error("[Dexie Seed] Failed to seed historical lessons:", err);
      }
    };

    seedHistory();
  }, [historyData, userId]);

  // 2. Trigger synchronization on mount and when connection comes back online
  useEffect(() => {
    if (typeof window === "undefined" || !userId) return;

    // Run initial sync
    syncLocalChangesToCloud(userId);

    const handleOnline = () => {
      console.log("[Network] Connection recovered. Triggering cloud synchronization...");
      syncLocalChangesToCloud(userId).then(res => {
        if (res.success) {
          reloadDraft();
        }
      });
    };

    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("online", handleOnline);
    };
  }, [userId, reloadDraft]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col gap-6 p-8 rounded-2xl border border-white/10 bg-slate-900/20 relative overflow-hidden">
        <div className="absolute inset-0 animate-shimmer opacity-25 pointer-events-none" />
        <div className="flex justify-between items-center">
          <div className="h-8 w-48 bg-slate-800/50 rounded-lg" />
          <div className="h-8 w-24 bg-slate-800/50 rounded-lg" />
        </div>
        <div className="space-y-3">
          <div className="h-4 w-full bg-slate-800/35 rounded" />
          <div className="h-4 w-5/6 bg-slate-800/35 rounded" />
          <div className="h-4 w-2/3 bg-slate-800/35 rounded" />
        </div>
        <div className="h-60 w-full bg-slate-900/30 rounded-2xl flex items-center justify-center border border-white/5">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 text-purple-500 animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Booting WebAssembly compiler...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-950/10 p-12 text-center">
        <h2 className="text-lg font-bold text-red-400">Workspace Fetch Error</h2>
        <p className="text-sm text-slate-400 mt-2">
          Unable to resolve local cache or download the requested lesson details.
        </p>
      </div>
    );
  }

  // Intercept if the lesson is in the background processing state
  if (draft.status === "processing") {
    return (
      <LoadingNewLesson
        lessonId={lessonId}
        onComplete={() => {
          window.location.reload();
        }}
      />
    );
  }

  // Fallback structures for safety
  const objectives = draft.structuredContent?.objectives || [];
  const concepts = draft.structuredContent?.concepts || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative">
      {/* Editor Main Canvas */}
      <div className={`${isRightPaneOpen ? "lg:col-span-8" : "lg:col-span-12"} flex flex-col gap-4 transition-all duration-300`}>
        <div className="flex flex-col gap-1 px-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-slate-100 tracking-tight">
              {draft.title || "Untitled Lesson"}
            </h2>
            {draft.status === "placeholder" && (
              <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                Draft — not published
              </span>
            )}
            {canPublish && draft.status === "placeholder" && (
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
              >
                {isPublishing ? "Publishing..." : "Publish Lesson"}
              </button>
            )}
            {/* Workspace persistence indicator */}
            <DraftSavedIndicator
              id={lessonId}
              title={draft.title || "Lesson Draft"}
              editor={editorRef.current}
              sandboxCode={currentCode ? { main: currentCode } : {}}
              currentTab={rightPaneView === "copilot" ? "tutor" : "editor"}
            />
          </div>
          <p className="text-xs text-slate-400">
            Offline-first enabled. Direct typing writes instantly to local database cache and schedules sync queues.
          </p>
        </div>

        <LessonEditor draft={draft} reloadDraft={reloadDraft} />

        {/* Challenge Panel sub-component */}
        <ChallengePanel
          challenges={challenges}
          lessonId={lessonId}
          onCodeChange={setCurrentCode}
          onErrorChange={setLastErrorLog}
          userId={userId}
        />
      </div>

      {/* Right Pane Column */}
      {isRightPaneOpen ? (
        <div className="lg:col-span-4 flex flex-col gap-4 transition-all duration-300">
          {/* Tabs bar */}
          <div className="flex items-center justify-between border border-white/10 bg-slate-900/40 backdrop-blur-md rounded-full p-1 select-none">
            <div className="flex items-center gap-1 flex-1">
              <button
                onClick={() => setRightPaneView("syllabus")}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all hover-lift active-press cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightPaneView === "syllabus"
                    ? "bg-slate-800 text-slate-100 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 text-purple-400" />
                Syllabus
              </button>
              <button
                onClick={() => setRightPaneView("copilot")}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition-all hover-lift active-press cursor-pointer flex items-center justify-center gap-1.5 ${
                  rightPaneView === "copilot"
                    ? "bg-purple-600 text-white shadow"
                    : "text-purple-400 hover:text-purple-300 bg-purple-950/10"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                AI Tutor
              </button>
            </div>
            <button
              onClick={() => setIsRightPaneOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-200 ml-1 rounded-full hover:bg-white/5 hover-lift active-press cursor-pointer"
              title="Collapse sidebar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Pane View Content */}
          {rightPaneView === "syllabus" ? (
            <div className="flex flex-col gap-6">
              {/* Objectives / Outline Metadata */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/20 p-5 backdrop-blur-md flex flex-col gap-5">
                <div>
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2.5 mb-3 select-none">
                    <ListChecks className="h-4.5 w-4.5 text-purple-400" />
                    <h3 className="font-heading text-sm font-bold text-slate-200">Learning Objectives</h3>
                  </div>
                  {objectives.length > 0 ? (
                    <ul className="space-y-2.5">
                      {objectives.map((obj: string, i: number) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs text-slate-300 leading-normal">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-purple-950/40 text-[10px] font-bold text-purple-400 border border-purple-800/30 select-none">
                            {i + 1}
                          </span>
                          <span>{obj}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No structured objectives found for this draft.</p>
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2 border-b border-white/5 pb-2.5 mb-3 select-none">
                    <GraduationCap className="h-4.5 w-4.5 text-purple-400" />
                    <h3 className="font-heading text-sm font-bold text-slate-200">Key Concepts</h3>
                  </div>
                  {concepts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {concepts.map((concept: string, i: number) => (
                        <span
                          key={i}
                          className="rounded-lg bg-purple-950/30 border border-purple-500/10 px-2.5 py-1 text-[11px] font-medium text-purple-300 select-none"
                        >
                          {concept}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No structured key concepts found.</p>
                  )}
                </div>

                {(() => {
                  const attachmentsList = draft.attachments || initialLesson.attachments || [];
                  if (attachmentsList.length === 0) return null;
                  return (
                    <div>
                      <div className="flex items-center gap-2 border-b border-white/5 pb-2.5 mb-3 select-none">
                        <FileText className="h-4.5 w-4.5 text-purple-400" />
                        <h3 className="font-heading text-sm font-bold text-slate-200">Classroom Attachments</h3>
                      </div>
                      <div className="space-y-2">
                        {attachmentsList.map((att: any, idx: number) => {
                          const isPdf = att.type === "pdf" || att.fileName.endsWith(".pdf");
                          const isImporting = importing[att.fileName];

                          return (
                            <div
                              key={idx}
                              className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-slate-950/20 px-3 py-2 text-[11px]"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <FileText className={`h-4 w-4 flex-shrink-0 ${isPdf ? "text-red-400" : "text-blue-400"}`} />
                                <span className="font-semibold text-slate-300 truncate max-w-[150px]" title={att.fileName}>
                                  {att.fileName}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  onClick={() => toast.info("Simulating document download...")}
                                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors hover-lift active-press cursor-pointer"
                                  title="Download"
                                >
                                  <Download className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  disabled={isImporting}
                                  onClick={() => handleImport(att.fileName)}
                                  className="flex items-center gap-1 rounded-full bg-purple-950/40 border border-purple-500/20 px-2.5 py-1 text-[10px] font-bold text-purple-300 hover:bg-purple-600 hover:text-white disabled:opacity-50 hover-lift active-press transition-colors cursor-pointer"
                                >
                                  {isImporting ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <span>Import</span>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Runtime Guide / Instructions */}
              <div className="rounded-2xl border border-white/10 bg-slate-900/20 p-5 backdrop-blur-md flex flex-col gap-3 select-none">
                <div className="flex items-center gap-2 border-b border-white/5 pb-2.5 mb-1">
                  <HelpCircle className="h-4.5 w-4.5 text-purple-400" />
                  <h3 className="font-heading text-sm font-bold text-slate-200">Interactive Studio Guide</h3>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  This editor supports compiling and executing code blocks natively within your browser:
                </p>
                <div className="space-y-3.5 mt-2">
                  <div className="flex items-start gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                    <div className="text-xs">
                      <strong className="text-slate-200">WASM Python Sandbox:</strong> Executes code blocks locally via Pyodide WebAssembly. Fully isolated.
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="h-2 w-2 rounded-full bg-purple-500 mt-1.5 shrink-0 animate-pulse" />
                    <div className="text-xs">
                      <strong className="text-slate-200">Node.js Container:</strong> Powered by StackBlitz WebContainers. Boots dynamic server subprocesses inside browser security contexts.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <CopilotSidebar
              lessonId={lessonId}
              currentCode={currentCode}
              lastErrorLog={lastErrorLog}
              onClose={() => setIsRightPaneOpen(false)}
              fallbackLessonTitle={draft.title}
              fallbackLessonContent={draft.content}
            />
          )}
        </div>
      ) : (
        /* Floating Toggle buttons when collapsed */
        <div className="fixed right-6 bottom-6 z-40 flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => {
              setRightPaneView("syllabus");
              setIsRightPaneOpen(true);
            }}
            className="flex h-11 items-center gap-2 rounded-full border border-white/10 bg-slate-900/90 hover:bg-slate-800 px-5 py-2.5 text-xs font-bold text-slate-200 shadow-2xl backdrop-blur-md hover-lift active-press transition-all cursor-pointer select-none"
            title="Open Syllabus Guide"
          >
            <BookOpen className="h-4 w-4 text-purple-400" />
            <span>Syllabus Guide</span>
          </button>
          <button
            onClick={() => {
              setRightPaneView("copilot");
              setIsRightPaneOpen(true);
            }}
            className="flex h-11 items-center gap-2 rounded-full border border-purple-500/20 bg-purple-950/90 hover:bg-purple-900/80 px-5 py-2.5 text-xs font-bold text-white shadow-2xl backdrop-blur-md hover-lift active-press transition-all cursor-pointer select-none"
            title="Open AI Tutor Copilot"
          >
            <Sparkles className="h-4 w-4 text-purple-300 animate-pulse" />
            <span>AI Tutor Chat</span>
          </button>
        </div>
      )}
    </div>
  );
}
