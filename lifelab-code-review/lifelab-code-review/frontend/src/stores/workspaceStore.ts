import { create } from "zustand";

import type { Note } from "../modules/notes/services/noteApi";

export type WorkspaceTab =
  | "notes"
  | "todos";

interface WorkspaceStore {
  activeTab: WorkspaceTab;
  pendingTaskSourceNote: Note | null;
  selectTab: (tab: WorkspaceTab) => void;
  beginTaskFromNote: (note: Note) => void;
  clearTaskSourceNote: () => void;
  reset: () => void;
}

export const useWorkspaceStore =
  create<WorkspaceStore>((set) => ({
    activeTab: "notes",
    pendingTaskSourceNote: null,

    selectTab: (activeTab) => {
      set({ activeTab });
    },

    beginTaskFromNote: (note) => {
      set({
        activeTab: "todos",
        pendingTaskSourceNote: note,
      });
    },

    clearTaskSourceNote: () => {
      set({
        pendingTaskSourceNote: null,
      });
    },

    reset: () => {
      set({
        activeTab: "notes",
        pendingTaskSourceNote: null,
      });
    },
  }));
