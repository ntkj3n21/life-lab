import { CheckSquare, StickyNote } from "lucide-react";
import { useState } from "react";

import { QuickNotePanel } from "../../modules/notes/components/QuickNotePanel";
import { TodoPanel } from "../../modules/todo/components/TodoPanel";

type DockTab = "notes" | "todos";

export function RightDock() {
  const [activeTab, setActiveTab] = useState<DockTab>("notes");

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-1">
        <button
          onClick={() => setActiveTab("notes")}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
            activeTab === "notes"
              ? "bg-white text-neutral-950"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
          }`}
        >
          <StickyNote size={16} />
          Notes
        </button>

        <button
          onClick={() => setActiveTab("todos")}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
            activeTab === "todos"
              ? "bg-white text-neutral-950"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
          }`}
        >
          <CheckSquare size={16} />
          Todos
        </button>
      </div>

      <div className="mt-4">
        {activeTab === "notes" ? <QuickNotePanel /> : <TodoPanel />}
      </div>
    </div>
  );
}