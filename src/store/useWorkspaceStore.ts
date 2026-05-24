import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";

// ─── Domain Types ─────────────────────────────────────────────────────────────

export type WorkspaceType = "lesson" | "exam" | "practice_question";

export type WorkspaceTab = "editor" | "sandbox" | "tutor" | "exam" | "results";

/**
 * A single captured workspace snapshot.
 * All fields are optional beyond id/type/title so partial updates are safe.
 */
export interface WorkspaceDraft {
  /** The workspace identifier — lessonId or examId */
  id: string;
  /** Workspace category for routing and icon selection */
  type: WorkspaceType;
  /** Human-readable title shown on the resume card */
  title: string;
  /** Unix epoch timestamp (ms) of the last write */
  lastAccessed: number;
  /**
   * Serialised Tiptap JSON document or raw text content.
   * Stored as a string to keep the Zustand serialiser fast.
   */
  editorState: string;
  /**
   * Map of challenge/sandbox identifier → current code string.
   * Key is typically the challenge id or a file path.
   */
  sandboxCode: Record<string, string>;
  /** Which tab/panel was active when the user left */
  currentTab: WorkspaceTab;
}

// ─── Store Interface ──────────────────────────────────────────────────────────

interface WorkspaceState {
  /** Primary map: workspaceId → draft snapshot */
  activeDrafts: Record<string, WorkspaceDraft>;
}

interface WorkspaceActions {
  /**
   * Upsert a draft entry. Performs a shallow merge so callers can send
   * only the fields that changed (e.g. just `sandboxCode`) without
   * accidentally wiping unrelated fields.
   */
  saveDraft: (id: string, partial: Partial<Omit<WorkspaceDraft, "id">> & Pick<WorkspaceDraft, "type" | "title">) => void;

  /**
   * Update a specific sandbox code file for an active draft.
   * Creates an empty draft shell if none exists yet.
   */
  updateSandboxCode: (id: string, fileKey: string, code: string) => void;

  /**
   * Update which tab is currently active for a draft.
   */
  setCurrentTab: (id: string, tab: WorkspaceTab) => void;

  /**
   * Remove a draft from the store entirely.
   * Call when the user completes an exam or marks a lesson finished.
   */
  clearDraft: (id: string) => void;

  /**
   * Wipe all active drafts. Use sparingly (e.g. on logout).
   */
  clearAllDrafts: () => void;

  /**
   * Returns all drafts sorted by lastAccessed descending (most recent first).
   * This is a derived selector — call inside a component with useWorkspaceStore.
   */
  getSortedDrafts: () => WorkspaceDraft[];
}

export type WorkspaceStore = WorkspaceState & WorkspaceActions;

// ─── Default values ───────────────────────────────────────────────────────────

const DEFAULT_DRAFT: Omit<WorkspaceDraft, "id" | "type" | "title"> = {
  lastAccessed: 0,
  editorState: "",
  sandboxCode: {},
  currentTab: "editor",
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      activeDrafts: {},

      // ── saveDraft ──────────────────────────────────────────────────────────
      saveDraft: (id, partial) => {
        set((state) => {
          const existing = state.activeDrafts[id] ?? {
            ...DEFAULT_DRAFT,
            id,
            type: partial.type,
            title: partial.title,
          };

          const updated: WorkspaceDraft = {
            ...existing,
            ...partial,
            id,
            lastAccessed: Date.now(),
          };

          return {
            activeDrafts: {
              ...state.activeDrafts,
              [id]: updated,
            },
          };
        });
      },

      // ── updateSandboxCode ──────────────────────────────────────────────────
      updateSandboxCode: (id, fileKey, code) => {
        set((state) => {
          const existing = state.activeDrafts[id];
          if (!existing) return state; // Can't update a non-existent draft

          const updated: WorkspaceDraft = {
            ...existing,
            sandboxCode: {
              ...existing.sandboxCode,
              [fileKey]: code,
            },
            lastAccessed: Date.now(),
          };

          return {
            activeDrafts: {
              ...state.activeDrafts,
              [id]: updated,
            },
          };
        });
      },

      // ── setCurrentTab ──────────────────────────────────────────────────────
      setCurrentTab: (id, tab) => {
        set((state) => {
          const existing = state.activeDrafts[id];
          if (!existing) return state;

          return {
            activeDrafts: {
              ...state.activeDrafts,
              [id]: { ...existing, currentTab: tab, lastAccessed: Date.now() },
            },
          };
        });
      },

      // ── clearDraft ─────────────────────────────────────────────────────────
      clearDraft: (id) => {
        set((state) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { [id]: _, ...rest } = state.activeDrafts;
          return { activeDrafts: rest };
        });
      },

      // ── clearAllDrafts ─────────────────────────────────────────────────────
      clearAllDrafts: () => set({ activeDrafts: {} }),

      // ── getSortedDrafts ────────────────────────────────────────────────────
      getSortedDrafts: () => {
        const drafts = Object.values(get().activeDrafts);
        return [...drafts].sort((a, b) => b.lastAccessed - a.lastAccessed);
      },
    }),
    {
      name: "workspace-drafts-v1",
      storage: createJSONStorage(() => localStorage),
      // Persist everything — activeDrafts is the whole point of this store.
      // The editor content is typically small enough for localStorage (< 5 MB limit).
      // If payloads ever exceed 4 MB for a single draft, swap the storage adapter
      // to a Dexie-backed custom storage here.
      partialize: (s) => ({ activeDrafts: s.activeDrafts }),
    }
  )
);

// ─── Convenience Selector Hooks ───────────────────────────────────────────────

const EMPTY_DRAFTS: WorkspaceDraft[] = [];

/**
 * Returns the draft for a specific id, or undefined if not captured yet.
 */
export function useDraft(id: string): WorkspaceDraft | undefined {
  return useWorkspaceStore((s) => s.activeDrafts[id]);
}

/**
 * Returns all drafts sorted by lastAccessed descending.
 * Stable reference — only re-renders when the activeDrafts map changes.
 */
export function useSortedDrafts(): WorkspaceDraft[] {
  return useWorkspaceStore(
    useShallow((s) => {
      const drafts = Object.values(s.activeDrafts);
      if (drafts.length === 0) return EMPTY_DRAFTS;
      return [...drafts].sort((a, b) => b.lastAccessed - a.lastAccessed);
    })
  );
}
