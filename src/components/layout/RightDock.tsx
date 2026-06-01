import { useState } from "react";
import { CheckSquare, NotebookPen } from "lucide-react";

import { QuickNotePanel } from "../../modules/notes/components/QuickNotePanel";
import { TodoPanel } from "../../modules/todo/components/TodoPanel";

type DockTab = "notes" | "todos";

const dockTabs = [
  {
    id: "notes" as const,
    label: "Notes",
    icon: NotebookPen,
  },
  {
    id: "todos" as const,
    label: "Todos",
    icon: CheckSquare,
  },
];

export function RightDock() {
  const [activeTab, setActiveTab] = useState<DockTab>("notes");

  return (
    <aside className="no-scrollbar w-[340px] shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-900/70 p-4">
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Right Dock</h3>

          <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-400">
            {activeTab === "notes" ? "Notes" : "Todos"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-neutral-800 bg-neutral-950 p-1">
          {dockTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                  isActive
                    ? "bg-white text-neutral-950"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-white"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "notes" && <QuickNotePanel />}
      {activeTab === "todos" && <TodoPanel />}
    </aside>
  );
}