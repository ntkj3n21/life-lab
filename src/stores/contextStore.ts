import { create } from "zustand";
import type { EntityType } from "../types/lifeLab";

interface ActiveContext {
  entityId: string;
  entityType: EntityType;
  title: string;
  timestamp?: number;
}

interface ContextStore {
  activeContext: ActiveContext | null;
  setActiveContext: (context: ActiveContext) => void;
  clearActiveContext: () => void;
}

export const useContextStore = create<ContextStore>((set) => ({
  activeContext: null,

  setActiveContext: (context) => {
    set({ activeContext: context });
  },

  clearActiveContext: () => {
    set({ activeContext: null });
  },
}));