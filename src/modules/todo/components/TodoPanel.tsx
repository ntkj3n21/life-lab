import { useState } from "react";
import { CheckCircle2, Circle, Trash2 } from "lucide-react";

import { useContextStore } from "../../../stores/contextStore";
import { useTodoStore } from "../../../stores/todoStore";
import { useVideoStore } from "../../../stores/videoStore";
import { formatTime } from "../../../utils/formatTime";

export function TodoPanel() {
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTodoContent, setEditingTodoContent] = useState("");
  const todos = useTodoStore((state) => state.todos);
  const updateTodo = useTodoStore((state) => state.updateTodo);
  const toggleTodo = useTodoStore((state) => state.toggleTodo);
  const toggleTodoItem = useTodoStore((state) => state.toggleTodoItem);
  const deleteTodo = useTodoStore((state) => state.deleteTodo);
  const clearTodos = useTodoStore((state) => state.clearTodos);
  const activeContext = useContextStore((state) => state.activeContext);
  const setActiveContext = useContextStore((state) => state.setActiveContext);
  const videos = useVideoStore((state) => state.videos);
  const currentContextTodos = activeContext
    ? todos
        .filter((todo) => todo.linkedEntityId === activeContext.entityId)
        .sort((a, b) => {
          if (a.done !== b.done) {
            return Number(a.done) - Number(b.done);
          }

          const aTimestamp = a.timestamp ?? 0;
          const bTimestamp = b.timestamp ?? 0;

          if (aTimestamp !== bTimestamp) {
            return aTimestamp - bTimestamp;
          }

          return b.createdAt - a.createdAt;
        })
    : [];

  const otherTodos = activeContext
    ? todos
        .filter((todo) => todo.linkedEntityId !== activeContext.entityId)
        .sort((a, b) => {
          if (a.done !== b.done) {
            return Number(a.done) - Number(b.done);
          }

          return b.createdAt - a.createdAt;
        })
    : [...todos].sort((a, b) => {
        if (a.done !== b.done) {
          return Number(a.done) - Number(b.done);
        }

        return b.createdAt - a.createdAt;
      });

  function handleOpenLinkedVideo(videoId: string, timestamp = 0) {
    const linkedVideo = videos.find((video) => video.id === videoId);

    if (!linkedVideo) return;

    setActiveContext({
      entityId: linkedVideo.id,
      entityType: linkedVideo.type,
      title: linkedVideo.title,
      timestamp,
    });
  }

  function handleStartEditTodo(todo: (typeof todos)[number]) {
    setEditingTodoId(todo.id);

    const draft = [
      todo.title,
      ...(todo.items?.length
        ? todo.items.map((item) => item.text)
        : todo.content
          ? todo.content.split("\n")
          : []),
    ]
      .filter(Boolean)
      .join("\n");

    setEditingTodoContent(draft);
  }

  function handleCancelEditTodo() {
    setEditingTodoId(null);
    setEditingTodoContent("");
  }

  function handleSaveEditTodo(todoId: string) {
    updateTodo(todoId, editingTodoContent);
    setEditingTodoId(null);
    setEditingTodoContent("");
  }

  function handleDeleteTodo(todoId: string) {
    const confirmed = window.confirm("Delete this todo?");

    if (!confirmed) return;

    deleteTodo(todoId);
  }

  function renderTodoCard(todo: (typeof todos)[number]) {
    const isCurrentContextTodo = todo.linkedEntityId === activeContext?.entityId;

    return (
      <div
        key={todo.id}
        className={`rounded-xl border p-3 transition ${
          isCurrentContextTodo
            ? "border-neutral-700 bg-neutral-900"
            : "border-neutral-800 bg-neutral-900"
        }`}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={() => toggleTodo(todo.id)}
            className="mt-0.5 shrink-0 text-neutral-400 hover:text-white"
          >
            {todo.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          </button>

          <div className="min-w-0 flex-1">
            {editingTodoId === todo.id ? (
              <div>
                <textarea
                  value={editingTodoContent}
                  onChange={(event) => setEditingTodoContent(event.target.value)}
                  className="h-24 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                />

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={handleCancelEditTodo}
                    className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() => handleSaveEditTodo(todo.id)}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p
                    className={`text-sm font-semibold leading-5 ${
                      todo.done
                        ? "text-neutral-500 line-through"
                        : "text-neutral-100"
                    }`}
                  >
                    {todo.title}
                  </p>

                  {todo.items && todo.items.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {todo.items.map((item) => (
                        <label
                          key={item.id}
                          className="flex items-start gap-2 text-sm text-neutral-300"
                        >
                          <button
                            onClick={() => toggleTodoItem(todo.id, item.id)}
                            className="mt-0.5 shrink-0 text-neutral-400 hover:text-white"
                          >
                            {item.done ? (
                              <CheckCircle2 size={16} />
                            ) : (
                              <Circle size={16} />
                            )}
                          </button>

                          <span
                            className={
                              item.done
                                ? "text-neutral-500 line-through"
                                : "text-neutral-300"
                            }
                          >
                            {item.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : todo.content ? (
                    <p className="mt-2 text-sm text-neutral-300">{todo.content}</p>
                  ) : (
                    <p className="mt-2 text-xs text-neutral-600">No checklist items</p>
                  )}
                </div>

                {todo.linkedEntityId ? (
                  <p className="mt-2 line-clamp-2 text-xs text-neutral-500">
                    From{" "}
                    <span className="text-neutral-300">
                      {todo.linkedEntityTitle ?? "Untitled"}
                    </span>
                    {typeof todo.timestamp === "number" && (
                      <span> · {formatTime(todo.timestamp)}</span>
                    )}
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-neutral-600">
                    No linked context
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    {isCurrentContextTodo && (
                      <span className="rounded-full bg-neutral-800 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {todo.linkedEntityType === "video" && todo.linkedEntityId && (
                      <button
                        onClick={() =>
                          handleOpenLinkedVideo(
                            todo.linkedEntityId!,
                            todo.timestamp ?? 0,
                          )
                        }
                        className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
                      >
                        Open
                      </button>
                    )}

                    <button
                      onClick={() => handleStartEditTodo(todo)}
                      className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDeleteTodo(todo.id)}
                      className="rounded-lg border border-neutral-800 p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  function handleClearTodos() {
    const confirmed = window.confirm("Clear all todos?");

    if (!confirmed) return;

    clearTodos();
  }

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium">Todos</h4>

        {todos.length > 0 && (
          <button
            onClick={handleClearTodos}
            className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {activeContext && todos.length > 0 && (
        <p className="mt-2 text-xs text-neutral-500">
          Todos linked to current context are shown first.
        </p>
      )}

      {todos.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">No todos yet.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {activeContext && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-3">
                <h5 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                  Current Video Todos
                </h5>

                <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-500">
                  {currentContextTodos.length}
                </span>
              </div>

              {currentContextTodos.length === 0 ? (
                <p className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
                  No todos for this video yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {currentContextTodos.map((todo) => renderTodoCard(todo))}
                </div>
              )}
            </section>
          )}

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h5 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                Other Todos
              </h5>

              <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-500">
                {otherTodos.length}
              </span>
            </div>

            {otherTodos.length === 0 ? (
              <p className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
                No other todos.
              </p>
            ) : (
              <div className="space-y-3">
                {otherTodos.map((todo) => renderTodoCard(todo))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}