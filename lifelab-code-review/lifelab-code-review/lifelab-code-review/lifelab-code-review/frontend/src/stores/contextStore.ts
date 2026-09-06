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
  setTimestamp: (timestamp: number) => void;
  increaseTimestamp: (seconds: number) => void;
  decreaseTimestamp: (seconds: number) => void;
}

export const useContextStore = create<ContextStore>((set) => ({
  activeContext: null,

  setActiveContext: (context) => {
    set({ activeContext: context });
  },

  clearActiveContext: () => {
    set({ activeContext: null });
  },

  setTimestamp: (timestamp) => {
    set((state) => {
      if (!state.activeContext) return state;

      return {
        activeContext: {
          ...state.activeContext,
          timestamp: Math.max(0, timestamp),
        },
      };
    });
  },

  increaseTimestamp: (seconds) => {
    set((state) => {
      if (!state.activeContext) return state;

      const currentTimestamp = state.activeContext.timestamp ?? 0;

      return {
        activeContext: {
          ...state.activeContext,
          timestamp: currentTimestamp + seconds,
        },
      };
    });
  },

  decreaseTimestamp: (seconds) => {
    set((state) => {
      if (!state.activeContext) return state;

      const currentTimestamp = state.activeContext.timestamp ?? 0;

      return {
        activeContext: {
          ...state.activeContext,
          timestamp: Math.max(0, currentTimestamp - seconds),
        },
      };
    });
  },
}));