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
}

export const useLayoutStore =
  create<LayoutStore>(
    (set) => ({
      isSidebarCollapsed: false,
      activeRightPanel: null,

      toggleSidebar: () => {
        set((state) => ({
          isSidebarCollapsed:
            !state.isSidebarCollapsed,
        }));
      },

      openRightPanel: (panel) => {
        set({
          activeRightPanel: panel,
        });
      },

      closeRightPanel: () => {
        set({
          activeRightPanel: null,
        });
      },
    }),
  );
