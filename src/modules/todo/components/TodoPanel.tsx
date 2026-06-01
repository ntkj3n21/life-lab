import { CheckCircle2, Circle, Trash2 } from "lucide-react";

import { useTodoStore } from "../../../stores/todoStore";

export function TodoPanel() {
  const todos = useTodoStore((state) => state.todos);
  const toggleTodo = useTodoStore((state) => state.toggleTodo);
  const deleteTodo = useTodoStore((state) => state.deleteTodo);
  const clearTodos = useTodoStore((state) => state.clearTodos);

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-medium">Todos</h4>

        {todos.length > 0 && (
          <button
            onClick={clearTodos}
            className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-white"
          >
            Clear
          </button>
        )}
      </div>

      {todos.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-500">Chưa có todo nào.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className="rounded-xl border border-neutral-800 bg-neutral-900 p-3"
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className="mt-0.5 text-neutral-400 hover:text-white"
                >
                  {todo.done ? (
                    <CheckCircle2 size={18} />
                  ) : (
                    <Circle size={18} />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm ${
                      todo.done
                        ? "text-neutral-500 line-through"
                        : "text-neutral-200"
                    }`}
                  >
                    {todo.content}
                  </p>

                  {todo.linkedEntityId ? (
                    <p className="mt-2 text-xs text-neutral-500">
                      From {todo.linkedEntityType}:{" "}
                      <span className="text-neutral-300">
                        {todo.linkedEntityTitle ?? todo.linkedEntityId}
                      </span>
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-neutral-600">
                      No linked context
                    </p>
                  )}
                </div>

                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="rounded-lg border border-neutral-800 p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}