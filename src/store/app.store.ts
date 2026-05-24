import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type ThemeMode = "light" | "dark" | "system";

interface UIState {
  theme: ThemeMode;
  sidebarOpen: boolean;
  commandPaletteOpen: boolean;
  activeDocument: { id: string; title: string } | null;
  isExamMode: boolean;
}

interface UIActions {
  setTheme: (t: ThemeMode) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setActiveDocument: (doc: { id: string; title: string } | null) => void;
  setIsExamMode: (enabled: boolean) => void;
}

export const useAppStore = create<UIState & UIActions>()(
  persist(
    (set) => ({
      theme: "system",
      sidebarOpen: true,
      commandPaletteOpen: false,
      activeDocument: null,
      isExamMode: false,
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleCommandPalette: () =>
        set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
      setActiveDocument: (doc) => set({ activeDocument: doc }),
      setIsExamMode: (isExamMode) => set({ isExamMode }),
    }),
    {
      name: "app-ui-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ theme: s.theme, sidebarOpen: s.sidebarOpen }),
    }
  )
);

interface DraftState {
  drafts: Record<string, { content: string; isDirty: boolean }>;
  setDraft: (id: string, content: string) => void;
  markClean: (id: string) => void;
  clearDraft: (id: string) => void;
}

export const useDraftStore = create<DraftState>()((set) => ({
  drafts: {},
  setDraft: (id, content) =>
    set((s) => ({ drafts: { ...s.drafts, [id]: { content, isDirty: true } } })),
  markClean: (id) =>
    set((s) => ({
      drafts: { ...s.drafts, [id]: { ...s.drafts[id], isDirty: false } },
    })),
  clearDraft: (id) =>
    set((s) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [id]: _, ...rest } = s.drafts;
      return { drafts: rest };
    }),
}));
