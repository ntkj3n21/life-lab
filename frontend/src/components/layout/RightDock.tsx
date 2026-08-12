import {
  CheckSquare,
  StickyNote,
} from "lucide-react";
import { useState } from "react";

import { QuickNotePanel } from "../../modules/notes/components/QuickNotePanel";
import { TodoPanel } from "../../modules/todo/components/TodoPanel";

type DockTab = "notes" | "todos";

export function RightDock() {
  const [activeTab, setActiveTab] =
    useState<DockTab>("notes");

  return (
    <div>
      <div
        role="tablist"
        aria-label="Workspace tools"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={
            activeTab === "notes"
          }
          onClick={() =>
            setActiveTab("notes")
          }
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 ${
            activeTab === "notes"
              ? "bg-white text-neutral-950"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
          }`}
        >
          <StickyNote size={16} />
          Notes
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={
            activeTab === "todos"
          }
          onClick={() =>
            setActiveTab("todos")
          }
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 ${
            activeTab === "todos"
              ? "bg-white text-neutral-950"
              : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
          }`}
        >
          <CheckSquare size={16} />
          Tasks
        </button>
      </div>

      <div className="mt-4">
        {activeTab === "notes" ? (
          <QuickNotePanel />
        ) : (
          <TodoPanel />
        )}
      </div>
    </div>
  );
}