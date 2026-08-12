import { PanelRight } from "lucide-react";

import { useLayoutStore } from "../../stores/layoutStore";
import { RightDock } from "./RightDock";

export function RightPanel() {
  const activeRightPanel =
    useLayoutStore(
      (state) =>
        state.activeRightPanel,
    );

  if (
    activeRightPanel !== "tools"
  ) {
    return null;
  }

  return (
    <aside
      aria-label="Workspace tools"
      className="w-80 shrink-0 border-l border-neutral-800 bg-neutral-950 2xl:w-95"
    >
      <div className="h-full overflow-y-auto p-4">
        <div className="mb-4 flex items-center gap-2">
          <PanelRight
            size={18}
            className="text-neutral-400"
            aria-hidden="true"
          />

          <div>
            <h3 className="font-semibold">
              Workspace Tools
            </h3>

            <p className="text-xs text-neutral-500">
              Notes and tasks for your current context.
            </p>
          </div>
        </div>

        <RightDock />
      </div>
    </aside>
  );
}