import { create } from "zustand";

type RightPanelType = "tools";

interface LayoutStore {
  isSidebarCollapsed: boolean;
  activeRightPanel:
    | RightPanelType
    | null;

  toggleSidebar: () => void;

  openRightPanel: (
    panel: RightPanelType,
  ) => void;

  closeRightPanel: () => void;

  toggleRightPanel: (
    panel: RightPanelType,
  ) => void;
}

export const useLayoutStore =
  create<LayoutStore>(
    (set) => ({
      isSidebarCollapsed: false,
      activeRightPanel: "tools",

      toggleSidebar: () => {
        set((state) => ({
          isSidebarCollapsed:
            !state.isSidebarCollapsed,
        }));
      },

      openRightPanel: (
        panel,
      ) => {
        set({
          activeRightPanel:
            panel,
        });
      },

      closeRightPanel: () => {
        set({
          activeRightPanel:
            null,
        });
      },

      toggleRightPanel: (
        panel,
      ) => {
        set((state) => ({
          activeRightPanel:
            state.activeRightPanel ===
            panel
              ? null
              : panel,
        }));
      },
    }),
  );