import {
  ChevronLeft,
  ChevronRight,
  PanelRight,
} from "lucide-react";

import { useLayoutStore } from "../../stores/layoutStore";
import { RightDock } from "./RightDock";

export function RightPanel() {
  const activeRightPanel =
    useLayoutStore(
      (state) =>
        state.activeRightPanel,
    );

  const openRightPanel =
    useLayoutStore(
      (state) =>
        state.openRightPanel,
    );

  const closeRightPanel =
    useLayoutStore(
      (state) =>
        state.closeRightPanel,
    );

  if (activeRightPanel !== "tools") {
    return (
      <aside
        aria-label="Workspace tools"
        className="flex w-9 shrink-0 items-start justify-center border-l border-(--border) bg-(--panel-bg) pt-3"
      >
        <button
          type="button"
          onClick={() =>
            openRightPanel("tools")
          }
          aria-label="Open workspace tools"
          title="Open workspace"
          className="flex h-8 w-8 items-center justify-center rounded-[9px] text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
        >
          <ChevronLeft
            size={16}
            aria-hidden="true"
          />
        </button>
      </aside>
    );
  }

  return (
    <aside
      aria-label="Workspace tools"
      className="w-80 shrink-0 border-l border-(--border) bg-(--panel-bg) 2xl:w-88"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-(--border) px-4">
          <PanelRight
            size={17}
            className="shrink-0 text-(--text-muted)"
            aria-hidden="true"
          />

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-medium text-(--text-primary)">
              Workspace
            </h3>

            <p className="truncate text-[11px] text-(--text-faint)">
              Notes and tasks for this context
            </p>
          </div>

          <button
            type="button"
            onClick={closeRightPanel}
            aria-label="Collapse workspace tools"
            title="Collapse workspace"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
          >
            <ChevronRight
              size={16}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <RightDock />
        </div>
      </div>
    </aside>
  );
}
