import { Music2, PanelRight } from "lucide-react";

import { useLayoutStore } from "../../stores/layoutStore";
import { MiniPlayer } from "./MiniPlayer";
import { RightDock } from "./RightDock";

export function RightPanel() {
  const activeRightPanel = useLayoutStore((state) => state.activeRightPanel);

  if (!activeRightPanel) {
    return null;
  }

  return (
    <aside className="w-[380px] shrink-0 border-l border-neutral-800 bg-neutral-950">
      {activeRightPanel === "tools" && (
        <div className="h-full overflow-y-auto p-4">
          <div className="mb-4 flex items-center gap-2">
            <PanelRight size={18} className="text-neutral-400" />
            <div>
              <h3 className="font-semibold">Workspace Tools</h3>
              <p className="text-xs text-neutral-500">
                Notes and tasks for your current context.
              </p>
            </div>
          </div>

          <RightDock />
        </div>
      )}

      {activeRightPanel === "player" && (
        <div className="h-full overflow-y-auto p-4">
          <div className="mb-4 flex items-center gap-2">
            <Music2 size={18} className="text-neutral-400" />
            <div>
              <h3 className="font-semibold">Mini Player</h3>
              <p className="text-xs text-neutral-500">
                Play tracks while you work.
              </p>
            </div>
          </div>

          <MiniPlayer />
        </div>
      )}
    </aside>
  );
}
