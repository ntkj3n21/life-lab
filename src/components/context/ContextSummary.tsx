import { CheckSquare, Clock, Link2, StickyNote } from "lucide-react";

import { useContextStore } from "../../stores/contextStore";
import { useNoteStore } from "../../stores/noteStore";
import { useTodoStore } from "../../stores/todoStore";
import { formatTime } from "../../utils/formatTime";

export function ContextSummary() {
  const activeContext = useContextStore((state) => state.activeContext);
  const notes = useNoteStore((state) => state.notes);
  const todos = useTodoStore((state) => state.todos);

  const relatedNotesCount = activeContext
    ? notes.filter((note) => note.linkedEntityId === activeContext.entityId)
        .length
    : 0;

  const relatedTodosCount = activeContext
    ? todos.filter((todo) => todo.linkedEntityId === activeContext.entityId)
        .length
    : 0;

  if (!activeContext) {
    return (
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-neutral-500" />
          <h4 className="font-medium">Now working on</h4>
        </div>

        <p className="mt-3 text-sm text-neutral-400">
          No active context yet.
        </p>

        <p className="mt-1 text-xs text-neutral-600">
          Open a video to start linking notes and todos.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link2 size={16} className="text-neutral-400" />
          <h4 className="font-medium">Now working on</h4>
        </div>

        <span className="rounded-full bg-neutral-800 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
          {activeContext.entityType}
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-base font-semibold text-neutral-100">
        {activeContext.title}
      </p>

      <div className="mt-3 flex items-center gap-2 text-sm text-neutral-400">
        <Clock size={14} className="text-neutral-500" />
        <span>
          Timestamp{" "}
          <span className="text-neutral-200">
            {formatTime(activeContext.timestamp)}
          </span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
          <div className="flex items-center gap-2 text-neutral-400">
            <StickyNote size={15} />
            <span className="text-xs">Notes</span>
          </div>

          <p className="mt-2 text-xl font-semibold text-neutral-100">
            {relatedNotesCount}
          </p>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
          <div className="flex items-center gap-2 text-neutral-400">
            <CheckSquare size={15} />
            <span className="text-xs">Todos</span>
          </div>

          <p className="mt-2 text-xl font-semibold text-neutral-100">
            {relatedTodosCount}
          </p>
        </div>
      </div>
    </div>
  );
}