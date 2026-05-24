/**
 * @file notifications.tsx
 * @description Centralized application notification manager with morphing animations.
 *
 * All toasts are rendered as custom JSX components via sonner's `toast.custom()`
 * API so we have full control over layout, icons, animation, and action buttons.
 * Uses Framer Motion to morph size, borders, glows, and icons across transitions.
 */

"use client";

import React from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Timer,
  FolderLock,
  Check,
  X,
  Terminal,
  Cpu,
  BookOpen,
  ExternalLink,
} from "lucide-react";

// ─── Shared Primitives & Styles ──────────────────────────────────────────────

/** Duration constants (ms) */
const DURATION = {
  flash: 2_000,
  standard: 4_500,
  long: 7_000,
  persistent: Infinity,
} as const;

type ToastTheme = "zinc" | "blue" | "green" | "amber" | "rose" | "violet" | "indigo";

const THEMES: Record<ToastTheme, {
  border: string;
  glow: string;
  leftBar: string;
  iconBg: string;
  iconColor: string;
}> = {
  zinc: {
    border: "rgba(226, 232, 240, 0.8)", // slate-200
    glow: "rgba(148, 163, 184, 0.04)",
    leftBar: "#64748b", // slate-500
    iconBg: "rgba(241, 245, 249, 0.9)", // slate-100
    iconColor: "#475569", // slate-600
  },
  blue: {
    border: "rgba(191, 219, 254, 0.8)", // blue-200
    glow: "rgba(59, 130, 246, 0.08)",
    leftBar: "#3b82f6", // blue-500
    iconBg: "rgba(239, 246, 255, 0.9)", // blue-50
    iconColor: "#2563eb", // blue-600
  },
  green: {
    border: "rgba(187, 247, 208, 0.8)", // green-200
    glow: "rgba(16, 185, 129, 0.08)",
    leftBar: "#10b981", // green-500
    iconBg: "rgba(240, 253, 240, 0.9)", // green-50
    iconColor: "#059669", // green-600
  },
  amber: {
    border: "rgba(254, 240, 138, 0.8)", // yellow-200
    glow: "rgba(245, 158, 11, 0.08)",
    leftBar: "#d97706", // amber-600
    iconBg: "rgba(254, 253, 242, 0.9)", // yellow-50
    iconColor: "#b45309", // amber-700
  },
  rose: {
    border: "rgba(254, 202, 202, 0.8)", // rose-200
    glow: "rgba(244, 63, 94, 0.1)",
    leftBar: "#f43f5e", // rose-500
    iconBg: "rgba(255, 241, 242, 0.9)", // rose-50
    iconColor: "#e11d48", // rose-600
  },
  violet: {
    border: "rgba(233, 213, 255, 0.8)", // violet-200
    glow: "rgba(139, 92, 246, 0.08)",
    leftBar: "#8b5cf6", // violet-500
    iconBg: "rgba(250, 245, 255, 0.9)", // violet-50
    iconColor: "#7c3aed", // violet-600
  },
  indigo: {
    border: "rgba(224, 231, 255, 0.8)", // indigo-200
    glow: "rgba(99, 102, 241, 0.08)",
    leftBar: "#6366f1", // indigo-500
    iconBg: "rgba(245, 247, 255, 0.9)", // indigo-50
    iconColor: "#4f46e5", // indigo-600
  },
};

/**
 * Renders the outer shell every custom toast shares, with morphing animations.
 */
function ToastShell({
  theme = "zinc",
  icon,
  children,
  action,
  pulse = false,
}: {
  theme: ToastTheme;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  pulse?: boolean;
}) {
  const currentTheme = THEMES[theme];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{
        opacity: 1,
        y: 0,
        scale: 1,
        borderColor: currentTheme.border,
        boxShadow: `0 10px 30px -10px rgba(148, 163, 184, 0.12), 0 0 20px 0px ${currentTheme.glow}`,
      }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      transition={{
        type: "spring",
        stiffness: 350,
        damping: 28,
      }}
      className="
        relative flex flex-col gap-3 rounded-xl border
        bg-white/95 backdrop-blur-md
        px-4 py-3.5 w-[360px] max-w-full overflow-hidden
      "
      style={{ fontFamily: "var(--font-sans, system-ui, sans-serif)" }}
    >
      {/* Morphing Background Glow Aura */}
      <motion.div
        layout
        className="absolute inset-0 opacity-40 pointer-events-none"
        animate={{
          background: `radial-gradient(circle at 10% 20%, ${currentTheme.glow} 0%, transparent 60%)`,
        }}
        transition={{ duration: 0.5 }}
      />

      {/* Ring pulse for high alert warning (like breach warning) */}
      {pulse && (
        <span className="absolute inset-0 rounded-xl ring-2 ring-rose-500/60 animate-ping pointer-events-none" />
      )}

      {/* Morphing Left Accent Bar */}
      <motion.div
        layout
        className="absolute inset-y-0 left-0 w-[3px] rounded-l-xl"
        animate={{
          backgroundColor: currentTheme.leftBar,
        }}
        transition={{ duration: 0.4 }}
      />

      <div className="flex items-start gap-3">
        {/* Animated Icon Container */}
        <motion.div
          layout
          className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg relative overflow-hidden"
          animate={{
            backgroundColor: currentTheme.iconBg,
            color: currentTheme.iconColor,
          }}
          transition={{ duration: 0.4 }}
        >
          {/* Animate Icon transition */}
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={theme}
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: 90, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 20 }}
              className="flex items-center justify-center"
            >
              {icon}
            </motion.div>
          </AnimatePresence>
          {pulse && (
            <span className="absolute inset-0 rounded-lg bg-rose-500/10 animate-pulse pointer-events-none" />
          )}
        </motion.div>

        {/* Body content */}
        <motion.div layout className="flex flex-1 flex-col gap-0.5 min-w-0">
          {children}
        </motion.div>
      </div>

      {action && (
        <motion.div
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="flex justify-end mt-1"
        >
          {action}
        </motion.div>
      )}
    </motion.div>
  );
}

function ToastTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-bold leading-snug text-slate-800">
      {children}
    </p>
  );
}

function ToastDescription({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] leading-relaxed text-slate-500">{children}</p>
  );
}

function ToastActionButton({
  onClick,
  children,
  variant = "default",
}: {
  onClick: () => void;
  children: React.ReactNode;
  variant?: "default" | "danger" | "success";
}) {
  const variants = {
    default:
      "border-violet-200 bg-violet-50 text-violet-600 hover:bg-violet-100 hover:text-violet-700",
    danger:
      "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700",
  };
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5
        text-[11px] font-bold transition-colors cursor-pointer
        ${variants[variant]}
      `}
    >
      {children}
    </motion.button>
  );
}

// ─── Stable toast IDs (prevent duplicate stacking & enable morphing) ──────────

const TOAST_IDS = {
  sync: "sync-toast",
  exam: "exam-toast",
  sandbox: "sandbox-toast",
  recall: "recall-toast",
} as const;

// ─── Type Definitions ─────────────────────────────────────────────────────────

export type SyncState = "offline" | "syncing" | "completed" | "error";

export type ExamLockdownEvent =
  | "breach_warning"
  | "time_critical"
  | "auto_submitted";

export type SandboxResult = "success" | "fail" | "syntax_error";

export interface SandboxDetails {
  passed: number;
  total: number;
  language: string;
}

export type AIRecallStatus = "started" | "reflecting" | "ready";

// ─── 1. appToast.sync ─────────────────────────────────────────────────────────

function syncToast(state: SyncState, pendingCount?: number) {
  switch (state) {
    case "offline": {
      toast.custom(
        () => (
          <ToastShell
            theme="zinc"
            icon={<WifiOff className="h-3.5 w-3.5" />}
          >
            <ToastTitle>Working Offline</ToastTitle>
            <ToastDescription>
              Changes are saved locally to Dexie.js and will sync when
              connectivity is restored.
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.sync,
          duration: DURATION.long,
        }
      );
      break;
    }

    case "syncing": {
      const count = pendingCount ?? 0;
      toast.custom(
        () => (
          <ToastShell
            theme="blue"
            icon={
              <RefreshCw
                className="h-3.5 w-3.5 animate-spin"
                style={{ animationDuration: "1.5s" }}
              />
            }
          >
            <ToastTitle>Synchronising</ToastTitle>
            <ToastDescription>
              Pushing{" "}
              <span className="font-bold text-blue-600">
                {count} local update{count !== 1 ? "s" : ""}
              </span>{" "}
              to database…
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.sync,
          duration: DURATION.persistent,
        }
      );
      break;
    }

    case "completed": {
      toast.custom(
        () => (
          <ToastShell
            theme="green"
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          >
            <ToastTitle>Synchronised</ToastTitle>
            <ToastDescription>
              All local changes are now persisted to the cloud database.
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.sync,
          duration: DURATION.flash,
        }
      );
      break;
    }

    case "error": {
      toast.custom(
        () => (
          <ToastShell
            theme="amber"
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
          >
            <ToastTitle>Sync Delayed</ToastTitle>
            <ToastDescription>
              Will retry automatically when connection stabilises. Data is safe
              in Dexie.js.
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.sync,
          duration: DURATION.long,
        }
      );
      break;
    }
  }
}

// ─── 2. appToast.examLockdown ─────────────────────────────────────────────────

function examLockdownToast(event: ExamLockdownEvent, data?: unknown) {
  void data;

  switch (event) {
    case "breach_warning": {
      toast.custom(
        () => (
          <ToastShell
            theme="rose"
            pulse
            icon={<ShieldAlert className="h-4 w-4" />}
          >
            <ToastTitle>
              <span className="font-black text-rose-700 tracking-wide uppercase">
                ⚠ Lockdown Breach
              </span>
            </ToastTitle>
            <ToastDescription>
              Leaving the exam window is logged. Further violations will trigger
              automatic submission.
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.exam,
          duration: DURATION.long,
        }
      );
      break;
    }

    case "time_critical": {
      toast.custom(
        () => (
          <ToastShell
            theme="amber"
            icon={<Timer className="h-3.5 w-3.5" />}
          >
            <div className="flex items-center gap-2">
              <ToastTitle>5 Minutes Remaining</ToastTitle>
              <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                URGENT
              </span>
            </div>
            <ToastDescription>
              Sidebar Copilot and all hints are completely disabled. Complete
              your answers now.
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.exam,
          duration: DURATION.long,
        }
      );
      break;
    }

    case "auto_submitted": {
      toast.custom(
        () => (
          <ToastShell
            theme="zinc"
            icon={<FolderLock className="h-3.5 w-3.5" />}
          >
            <ToastTitle>Exam Auto-Submitted</ToastTitle>
            <ToastDescription>
              Time expired. Your paper has been forwarded to AI evaluation.
              Results will appear in the Diagnostics panel.
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.exam,
          duration: DURATION.standard,
        }
      );
      break;
    }
  }
}

// ─── 3. appToast.sandbox ─────────────────────────────────────────────────────

function sandboxToast(
  result: SandboxResult,
  details: SandboxDetails,
  onOpenTutor?: () => void
) {
  const { passed, total, language } = details;
  const lang = language.charAt(0).toUpperCase() + language.slice(1);

  switch (result) {
    case "success": {
      toast.custom(
        () => (
          <ToastShell
            theme="green"
            icon={<Check className="h-3.5 w-3.5" />}
          >
            <div className="flex items-center gap-2">
              <ToastTitle>All Tests Passed</ToastTitle>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {lang}
              </span>
            </div>
            <ToastDescription>
              <span className="font-bold text-emerald-700">
                {passed}/{total}
              </span>{" "}
              test cases passed successfully. Challenge complete!
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.sandbox,
          duration: DURATION.standard,
        }
      );
      break;
    }

    case "fail": {
      toast.custom(
        (toastId) => (
          <ToastShell
            theme="rose"
            icon={<X className="h-3.5 w-3.5" />}
            action={
              onOpenTutor && (
                <ToastActionButton
                  onClick={() => {
                    onOpenTutor();
                    toast.dismiss(toastId);
                  }}
                  variant="danger"
                >
                  <Cpu className="h-3 w-3" />
                  Ask Tutor to debug
                </ToastActionButton>
              )
            }
          >
            <div className="flex items-center gap-2">
              <ToastTitle>Tests Failed</ToastTitle>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                {lang}
              </span>
            </div>
            <ToastDescription>
              <span className="font-bold text-rose-700">
                {passed}/{total}
              </span>{" "}
              test cases passed. Review the output pane for assertion details.
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.sandbox,
          duration: DURATION.long,
        }
      );
      break;
    }

    case "syntax_error": {
      toast.custom(
        () => (
          <ToastShell
            theme="zinc"
            icon={<Terminal className="h-3.5 w-3.5" />}
          >
            <div className="flex items-center gap-2">
              <ToastTitle>Compilation Failed</ToastTitle>
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {lang}
              </span>
            </div>
            <ToastDescription>
              Syntax error detected. Check the terminal output pane for the
              exact traceback and line number.
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.sandbox,
          duration: DURATION.standard,
        }
      );
      break;
    }
  }
}

// ─── 4. appToast.aiRecall ─────────────────────────────────────────────────────

function aiRecallToast(
  status: AIRecallStatus,
  options?: {
    lessonId?: string;
    onOpenLesson?: (lessonId: string) => void;
  }
) {
  const { lessonId, onOpenLesson } = options ?? {};

  switch (status) {
    case "started": {
      toast.custom(
        () => (
          <ToastShell
            theme="violet"
            icon={
              <RefreshCw
                className="h-3.5 w-3.5 animate-spin"
                style={{ animationDuration: "2s" }}
              />
            }
          >
            <div className="flex items-center gap-2">
              <ToastTitle>Recall Pipeline Started</ToastTitle>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 border border-violet-200 animate-pulse">
                AI
              </span>
            </div>
            <ToastDescription>
              Extracting Teams context nodes and seeding lesson structure…
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.recall,
          duration: DURATION.standard,
        }
      );
      break;
    }

    case "reflecting": {
      toast.custom(
        () => (
          <ToastShell
            theme="indigo"
            icon={
              <Cpu
                className="h-3.5 w-3.5 animate-pulse"
                style={{ animationDuration: "1.5s" }}
              />
            }
          >
            <div className="flex items-center gap-2">
              <ToastTitle>Self-Correction Loop Active</ToastTitle>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 border border-indigo-200 animate-pulse">
                CRITIQUING
              </span>
            </div>
            <ToastDescription>
              AI is auditing structural layout gaps and refining deep-recall
              node quality…
            </ToastDescription>
            {/* Simulated progress bar */}
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <motion.div
                initial={{ width: "10%" }}
                animate={{ width: "75%" }}
                transition={{ duration: 4, ease: "easeInOut" }}
                className="h-full rounded-full bg-indigo-500"
              />
            </div>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.recall,
          duration: DURATION.standard,
        }
      );
      break;
    }

    case "ready": {
      toast.custom(
        (toastId) => (
          <ToastShell
            theme="green"
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            action={
              lessonId && onOpenLesson && (
                <ToastActionButton
                  onClick={() => {
                    onOpenLesson(lessonId);
                    toast.dismiss(toastId);
                  }}
                  variant="success"
                >
                  <BookOpen className="h-3 w-3" />
                  Open Lesson Studio
                  <ExternalLink className="h-2.5 w-2.5 ml-0.5 opacity-70" />
                </ToastActionButton>
              )
            }
          >
            <div className="flex items-center gap-2">
              <ToastTitle>Lesson Ready</ToastTitle>
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                RECALL
              </span>
            </div>
            <ToastDescription>
              New lesson placeholder is fully prepared with recall nodes,
              challenges, and deep-drill questions.
            </ToastDescription>
          </ToastShell>
        ),
        {
          id: TOAST_IDS.recall,
          duration: DURATION.long,
        }
      );
      break;
    }
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const appToast = {
  sync: syncToast,
  examLockdown: examLockdownToast,
  sandbox: (
    result: SandboxResult,
    details: SandboxDetails,
    onOpenTutor?: () => void
  ) => sandboxToast(result, details, onOpenTutor),
  aiRecall: (
    status: AIRecallStatus,
    options?: { lessonId?: string; onOpenLesson?: (id: string) => void }
  ) => aiRecallToast(status, options),
  dismiss: toast.dismiss,
} as const;
