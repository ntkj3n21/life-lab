import { create } from "zustand";

type RightPanelType = "tools";

export const SIDEBAR_MIN_WIDTH = 208;
export const SIDEBAR_MAX_WIDTH = 320;
export const SIDEBAR_DEFAULT_WIDTH = 240;

export const RIGHT_PANEL_MIN_WIDTH = 280;
export const RIGHT_PANEL_MAX_WIDTH = 440;
export const RIGHT_PANEL_DEFAULT_WIDTH = 352;

function clampWidth(
  width: number,
  minimum: number,
  maximum: number,
) {
  return Math.min(
    maximum,
    Math.max(minimum, width),
  );
}

interface LayoutStore {
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  rightPanelWidth: number;
  activeRightPanel:
    | RightPanelType
    | null;

  toggleSidebar: () => void;
  setSidebarWidth: (
    width: number,
  ) => void;
  setRightPanelWidth: (
    width: number,
  ) => void;

  openRightPanel: (
    panel: RightPanelType,
  ) => void;

  closeRightPanel: () => void;
}

export const useLayoutStore =
  create<LayoutStore>(
    (set) => ({
      isSidebarCollapsed: false,
      sidebarWidth:
        SIDEBAR_DEFAULT_WIDTH,
      rightPanelWidth:
        RIGHT_PANEL_DEFAULT_WIDTH,
      activeRightPanel: null,

      toggleSidebar: () => {
        set((state) => ({
          isSidebarCollapsed:
            !state.isSidebarCollapsed,
        }));
      },

      setSidebarWidth: (width) => {
        set({
          sidebarWidth: clampWidth(
            width,
            SIDEBAR_MIN_WIDTH,
            SIDEBAR_MAX_WIDTH,
          ),
        });
      },

      setRightPanelWidth: (width) => {
        set({
          rightPanelWidth: clampWidth(
            width,
            RIGHT_PANEL_MIN_WIDTH,
            RIGHT_PANEL_MAX_WIDTH,
          ),
        });
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
