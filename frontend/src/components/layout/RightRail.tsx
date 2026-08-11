import { Music2, PanelRight, X } from "lucide-react";

import { useLayoutStore } from "../../stores/layoutStore";

export function RightRail() {
  const activeRightPanel = useLayoutStore((state) => state.activeRightPanel);
  const toggleRightPanel = useLayoutStore((state) => state.toggleRightPanel);
  const closeRightPanel = useLayoutStore((state) => state.closeRightPanel);

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-l border-neutral-800 bg-neutral-950 py-3">
      <div className="flex flex-col gap-2">
        <button
          onClick={() => toggleRightPanel("tools")}
          className={`rounded-xl p-2 transition ${
            activeRightPanel === "tools"
              ? "bg-white text-neutral-950"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
          }`}
          title="Tools"
        >
          <PanelRight size={18} />
        </button>

        <button
          onClick={() => toggleRightPanel("player")}
          className={`rounded-xl p-2 transition ${
            activeRightPanel === "player"
              ? "bg-white text-neutral-950"
              : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
          }`}
          title="Player"
        >
          <Music2 size={18} />
        </button>
      </div>

      <div className="mt-auto">
        {activeRightPanel && (
          <button
            onClick={closeRightPanel}
            className="rounded-xl p-2 text-neutral-500 hover:bg-neutral-900 hover:text-white"
            title="Close panel"
          >
            <X size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}