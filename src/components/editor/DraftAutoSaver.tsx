"use client";

import { useEffect, useRef, useCallback } from "react";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import type { Editor } from "@tiptap/react";
import type { WorkspaceTab } from "@/store/useWorkspaceStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface DraftAutoSaverOptions {
  /** The workspace/lesson identifier */
  id: string;
  /** Human-readable title to label the resume card */
  title: string;
  /** Live Tiptap editor instance (may be null before editor mounts) */
  editor: Editor | null;
  /** Current sandbox code keyed by challenge id or file key */
  sandboxCode?: Record<string, string>;
  /** Which tab/panel is currently visible */
  currentTab?: WorkspaceTab;
  /** Debounce delay in ms (default: 1500) */
  debounceMs?: number;
}

interface DraftAutoSaverReturn {
  /** True for ~2 s after each successful write — drive the "Saved" indicator */
  isSaving: boolean;
  /** Imperatively flush any pending debounced save immediately */
  flushNow: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * `useDraftAutoSaver` — headless hook that:
 * 1. Registers a Tiptap `update` listener and debounces it.
 * 2. Detects changes in `sandboxCode` and `currentTab` refs and merges them.
 * 3. Writes to `useWorkspaceStore` on every debounced flush.
 *
 * Designed to be called once inside `LessonStudioClient` — no JSX required.
 */
export function useDraftAutoSaver({
  id,
  title,
  editor,
  sandboxCode = {},
  currentTab = "editor",
  debounceMs = 1500,
}: DraftAutoSaverOptions): DraftAutoSaverReturn {
  const saveDraft = useWorkspaceStore((s) => s.saveDraft);

  // Debounce timer ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether we're in the "just saved" pulse window
  const isSavingRef = useRef(false);
  // Force re-render counter to surface isSaving to callers
  // We use a ref-based approach to avoid unnecessary renders in the parent
  const savingListeners = useRef<Set<() => void>>(new Set());

  // Keep mutable copies of sandbox/tab so the Tiptap callback always sees
  // the latest values without requiring a fresh listener each render
  const sandboxRef = useRef(sandboxCode);
  const tabRef = useRef(currentTab);

  useEffect(() => {
    sandboxRef.current = sandboxCode;
  });

  useEffect(() => {
    tabRef.current = currentTab;
  });

  const flush = useCallback(
    (editorJSON?: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const snapshot = editorJSON ?? (editor ? JSON.stringify(editor.getJSON()) : "");

      saveDraft(id, {
        type: "lesson",
        title,
        editorState: snapshot,
        sandboxCode: { ...sandboxRef.current },
        currentTab: tabRef.current,
      });

      // Signal "saved" for 2 s
      isSavingRef.current = true;
      savingListeners.current.forEach((fn) => fn());
      setTimeout(() => {
        isSavingRef.current = false;
        savingListeners.current.forEach((fn) => fn());
      }, 2000);
    },
    [id, title, editor, saveDraft]
  );

  // ── Tiptap listener ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        flush(JSON.stringify(editor.getJSON()));
      }, debounceMs);
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [editor, debounceMs, flush]);

  // ── Sandbox code change watcher ────────────────────────────────────────────
  // Stringify for a stable comparison (values are usually short code strings)
  const sandboxKey = JSON.stringify(sandboxCode);
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush();
    }, debounceMs);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sandboxKey]);

  // ── Tab change watcher (immediate, no debounce) ───────────────────────────
  useEffect(() => {
    saveDraft(id, {
      type: "lesson",
      title,
      editorState: editor ? JSON.stringify(editor.getJSON()) : "",
      sandboxCode: { ...sandboxRef.current },
      currentTab,
    });
    // Only run on tab changes, not every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTab]);

  return {
    get isSaving() {
      return isSavingRef.current;
    },
    flushNow: () => flush(),
  };
}

// ─── Visible Indicator Component ──────────────────────────────────────────────

/**
 * `DraftSavedIndicator` — renders a small pulsing badge that appears for 2 s
 * after each write. Mount it in the studio header next to the title.
 *
 * @example
 * <DraftSavedIndicator id={lessonId} title={draft.title} editor={editor} sandboxCode={code} />
 */

import React, { useState } from "react";
import { CheckCircle2, CloudOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DraftSavedIndicatorProps
  extends Omit<DraftAutoSaverOptions, "debounceMs"> {
  debounceMs?: number;
}

export function DraftSavedIndicator(props: DraftSavedIndicatorProps) {
  const [visible, setVisible] = useState(false);

  const { flushNow } = useDraftAutoSaver({
    ...props,
    debounceMs: props.debounceMs ?? 1500,
  });

  // Subscribe to saveDraft mutations via the store
  const saveDraft = useWorkspaceStore((s) => s.saveDraft);

  // Wrap saveDraft to intercept and flash the indicator
  const patchedSaveDraft = useCallback(
    (...args: Parameters<typeof saveDraft>) => {
      saveDraft(...args);
      setVisible(true);
      setTimeout(() => setVisible(false), 2200);
    },
    [saveDraft]
  );

  // Re-wire: since we can't override the store directly, poll the lastAccessed
  // timestamp of this draft and flash on change
  const lastAccessed = useWorkspaceStore(
    (s) => s.activeDrafts[props.id]?.lastAccessed ?? 0
  );
  const prevRef = useRef(lastAccessed);

  useEffect(() => {
    if (lastAccessed !== prevRef.current) {
      prevRef.current = lastAccessed;
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2200);
      return () => clearTimeout(t);
    }
  }, [lastAccessed]);

  // Prevent patchedSaveDraft unused warning
  void patchedSaveDraft;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="saved-badge"
          initial={{ opacity: 0, scale: 0.85, y: -4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -4 }}
          transition={{ duration: 0.2 }}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-950/30 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 select-none"
          aria-live="polite"
          aria-label="Draft saved to local cache"
        >
          <CheckCircle2 className="h-3 w-3" />
          Saved to local cache
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Re-export CloudOff for usage in studio header offline states
export { CloudOff };
