import {
  CheckSquare,
  StickyNote,
} from "lucide-react";
import { useState } from "react";

import { QuickNotePanel } from "../../modules/notes/components/QuickNotePanel";
import { TodoPanel } from "../../modules/todo/components/TodoPanel";
import { useNoteStore } from "../../stores/noteStore";
import { useTodoStore } from "../../stores/todoStore";

type DockTab = "notes" | "todos";

export function RightDock() {
  const [activeTab, setActiveTab] =
    useState<DockTab>("notes");

  const noteCount = useNoteStore(
    (state) => state.totalElements,
  );

  const taskCount = useTodoStore(
    (state) => state.totalElements,
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Workspace tools"
        className="grid grid-cols-2 gap-1 rounded-[11px] bg-(--surface) p-1"
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
          className={`flex h-9 items-center justify-center gap-2 rounded-[9px] px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${
            activeTab === "notes"
              ? "bg-(--surface-active) text-(--text-primary)"
              : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary)"
          }`}
        >
          <StickyNote
            size={15}
            aria-hidden="true"
          />
          Notes
          <span className="text-[11px] text-(--text-faint)">
            {noteCount}
          </span>
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
          className={`flex h-9 items-center justify-center gap-2 rounded-[9px] px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${
            activeTab === "todos"
              ? "bg-(--surface-active) text-(--text-primary)"
              : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary)"
          }`}
        >
          <CheckSquare
            size={15}
            aria-hidden="true"
          />
          Tasks
          <span className="text-[11px] text-(--text-faint)">
            {taskCount}
          </span>
        </button>
      </div>

      <div className="mt-3">
        {activeTab === "notes" ? (
          <QuickNotePanel />
        ) : (
          <TodoPanel />
        )}
      </div>
    </div>
  );
}
