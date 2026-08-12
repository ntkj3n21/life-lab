import {
  Film,
  Music,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { useLayoutStore } from "../../stores/layoutStore";

export function Sidebar() {
  const isSidebarCollapsed =
    useLayoutStore(
      (state) =>
        state.isSidebarCollapsed,
    );

  const toggleSidebar =
    useLayoutStore(
      (state) =>
        state.toggleSidebar,
    );

  const openRightPanel =
    useLayoutStore(
      (state) =>
        state.openRightPanel,
    );

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 transition-all ${
        isSidebarCollapsed
          ? "w-16"
          : "w-64"
      }`}
    >
      <div className="flex items-center justify-between border-b border-neutral-800 p-4">
        {!isSidebarCollapsed && (
          <div>
            <h1 className="font-semibold">
              Life Lab
            </h1>

            <p className="text-xs text-neutral-500">
              Personal workspace
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={toggleSidebar}
          className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          title={
            isSidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen
              size={16}
            />
          ) : (
            <PanelLeftClose
              size={16}
            />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <div
          className={`flex w-full items-center gap-3 rounded-xl bg-neutral-800 px-3 py-2 text-sm text-white ${
            isSidebarCollapsed
              ? "justify-center"
              : ""
          }`}
          title={
            isSidebarCollapsed
              ? "Media"
              : undefined
          }
        >
          <Film
            size={18}
            className="shrink-0"
          />

          {!isSidebarCollapsed && (
            <span>
              Media
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() =>
            openRightPanel(
              "player",
            )
          }
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white ${
            isSidebarCollapsed
              ? "justify-center"
              : ""
          }`}
          title={
            isSidebarCollapsed
              ? "Music"
              : undefined
          }
        >
          <Music
            size={18}
            className="shrink-0"
          />

          {!isSidebarCollapsed && (
            <span>
              Music
            </span>
          )}
        </button>
      </nav>
    </aside>
  );
}