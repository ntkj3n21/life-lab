import {
  LoaderCircle,
  Search,
} from "lucide-react";

import type {
  Task,
  TaskStatus,
  UpdateTaskInput,
} from "../services/taskApi";
import { TaskCard } from "./TaskCard";

export type StatusFilter =
  | ""
  | TaskStatus;

interface TaskListPanelProps {
  tasks: Task[];
  totalElements: number;

  searchText: string;
  statusFilter: StatusFilter;

  isLoading: boolean;
  isMutating: boolean;

  onSearchTextChange: (value: string) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onApplySearch: () => Promise<void>;

  onUpdate: (
    taskId: number,
    input: UpdateTaskInput,
  ) => Promise<void>;

  onStatusChange: (
    taskId: number,
    status: TaskStatus,
  ) => Promise<void>;

  onDelete: (
    taskId: number,
  ) => Promise<void>;
}

export function TaskListPanel({
  tasks,
  totalElements,
  searchText,
  statusFilter,
  isLoading,
  isMutating,
  onSearchTextChange,
  onStatusFilterChange,
  onApplySearch,
  onUpdate,
  onStatusChange,
  onDelete,
}: TaskListPanelProps) {
  return (
    <details
      aria-busy={isLoading}
      className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
    >
      <summary className="cursor-pointer text-sm font-medium text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700">
        All Tasks ({totalElements})
      </summary>

      <div className="mt-3 flex gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3 focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-700">
          <Search
            size={14}
            className="text-neutral-600"
            aria-hidden="true"
          />

          <label
            htmlFor="task-search"
            className="sr-only"
          >
            Search tasks
          </label>

          <input
            id="task-search"
            value={searchText}
            disabled={isLoading}
            onChange={(event) =>
              onSearchTextChange(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void onApplySearch();
              }
            }}
            placeholder="Search..."
            className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </div>

      <label
        htmlFor="task-status-filter"
        className="sr-only"
      >
        Filter tasks by status
      </label>

      <select
        id="task-status-filter"
        value={statusFilter}
        disabled={isLoading}
        onChange={(event) =>
          onStatusFilterChange(
            event.target.value as StatusFilter,
          )
        }
        className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">
          All statuses
        </option>

        <option value="NOT_STARTED">
          Not started
        </option>

        <option value="IN_PROGRESS">
          In progress
        </option>

        <option value="COMPLETED">
          Completed
        </option>
      </select>

      <button
        type="button"
        disabled={isLoading}
        onClick={() =>
          void onApplySearch()
        }
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isLoading && (
          <LoaderCircle
            size={13}
            className="animate-spin"
            aria-hidden="true"
          />
        )}

        {isLoading
          ? "Applying..."
          : "Apply"}
      </button>

      {isLoading ? (
        <p
          role="status"
          className="mt-3 text-xs text-neutral-500"
        >
          Loading tasks...
        </p>
      ) : tasks.length === 0 ? (
        <p
          role="status"
          className="mt-3 rounded-xl border border-dashed border-neutral-800 p-3 text-xs text-neutral-600"
        >
          No tasks match the current filters.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isMutating={isMutating}
              onUpdate={onUpdate}
              onStatusChange={
                onStatusChange
              }
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </details>
  );
}