import { create } from "zustand";

import {
  applyAppearance,
  getInitialAppearance,
  type Appearance,
} from "../theme/appearance";

interface AppearanceStore {
  appearance: Appearance;
  setAppearance: (
    appearance: Appearance,
  ) => void;
  toggleAppearance: () => void;
}

const initialAppearance =
  getInitialAppearance();

export const useAppearanceStore =
  create<AppearanceStore>((set) => ({
    appearance: initialAppearance,

    setAppearance: (appearance) => {
      applyAppearance(appearance);
      set({ appearance });
    },

    toggleAppearance: () => {
      set((state) => {
        const appearance =
          state.appearance === "dark"
            ? "light"
            : "dark";

        applyAppearance(appearance);

        return { appearance };
      });
    },
  }));
