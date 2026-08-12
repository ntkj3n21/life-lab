import {
  PanelRight,
  X,
} from "lucide-react";

import { useLayoutStore } from "../../stores/layoutStore";

export function RightRail() {
  const activeRightPanel =
    useLayoutStore(
      (state) =>
        state.activeRightPanel,
    );

  const toggleRightPanel =
    useLayoutStore(
      (state) =>
        state.toggleRightPanel,
    );

  const closeRightPanel =
    useLayoutStore(
      (state) =>
        state.closeRightPanel,
    );

  return (
    <aside
      aria-label="Workspace panel controls"
      className="flex w-14 shrink-0 flex-col items-center border-l border-neutral-800 bg-neutral-950 py-3"
    >
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() =>
            toggleRightPanel(
              "tools",
            )
          }
          aria-label="Toggle workspace tools"
          aria-pressed={
            activeRightPanel ===
            "tools"
          }
          className={`rounded-xl p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 ${
            activeRightPanel ===
            "tools"
              ? "bg-white text-neutral-950"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
          }`}
          title="Tools"
        >
          <PanelRight
            size={18}
            aria-hidden="true"
          />
        </button>
      </div>

      <div className="mt-auto">
        {activeRightPanel && (
          <button
            type="button"
            onClick={
              closeRightPanel
            }
            aria-label="Close right panel"
            className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
            title="Close panel"
          >
            <X
              size={18}
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </aside>
  );
}