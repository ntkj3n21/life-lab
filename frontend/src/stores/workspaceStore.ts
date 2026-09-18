import { create } from "zustand";

import type { Note } from "../modules/notes/services/noteApi";

export type WorkspaceTab =
  | "notes"
  | "todos";

interface WorkspaceStore {
  activeTab: WorkspaceTab;
  pendingTaskSourceNote: Note | null;
  pendingTaskSourceKind:
    | "explicit"
    | "picker"
    | null;
  selectTab: (tab: WorkspaceTab) => void;
  beginTaskFromNote: (note: Note) => void;
  selectTaskSourceNote: (note: Note) => void;
  clearTaskSourceNote: () => void;
  clearPickerTaskSourceNote: () => void;
  reset: () => void;
}

export const useWorkspaceStore =
  create<WorkspaceStore>((set) => ({
    activeTab: "notes",
    pendingTaskSourceNote: null,
    pendingTaskSourceKind: null,

    selectTab: (activeTab) => {
      set({ activeTab });
    },

    beginTaskFromNote: (note) => {
      set({
        activeTab: "todos",
        pendingTaskSourceNote: note,
        pendingTaskSourceKind: "explicit",
      });
    },

    selectTaskSourceNote: (note) => {
      set({
        pendingTaskSourceNote: note,
        pendingTaskSourceKind: "picker",
      });
    },

    clearTaskSourceNote: () => {
      set({
        pendingTaskSourceNote: null,
        pendingTaskSourceKind: null,
      });
    },

    clearPickerTaskSourceNote: () => {
      set((state) =>
        state.pendingTaskSourceKind === "picker"
          ? {
              pendingTaskSourceNote: null,
              pendingTaskSourceKind: null,
            }
          : state,
      );
    },

    reset: () => {
      set({
        activeTab: "notes",
        pendingTaskSourceNote: null,
        pendingTaskSourceKind: null,
      });
    },
  }));
