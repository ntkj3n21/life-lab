import {
  ChevronDown,
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
  loadErrorMessage?: string | null;
  actionErrorMessage?: string | null;

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

  onOpenDetail: (
    taskId: number,
  ) => void;
}

export function TaskListPanel({
  tasks,
  totalElements,
  searchText,
  statusFilter,
  isLoading,
  isMutating,
  loadErrorMessage,
  actionErrorMessage,
  onSearchTextChange,
  onStatusFilterChange,
  onApplySearch,
  onUpdate,
  onStatusChange,
  onDelete,
  onOpenDetail,
}: TaskListPanelProps) {
  return (
    <details
      aria-busy={isLoading}
      className="group mt-4"
    >
    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-xs font-medium text-(--text-muted) outline-none transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus)">
      <span>
        All tasks · {totalElements}
      </span>

      <ChevronDown
        size={14}
        className="shrink-0 text-(--text-faint) transition-transform duration-150 group-open:rotate-180"
        aria-hidden="true"
      />
    </summary>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-(--border) bg-(--surface) px-3 focus-within:border-(--border-strong) focus-within:ring-2 focus-within:ring-(--focus)">
          <Search
            size={13}
            className="shrink-0 text-(--text-faint)"
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
            placeholder="Search tasks..."
            className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none placeholder:text-(--text-faint) disabled:cursor-not-allowed disabled:opacity-50"
          />
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
          className="h-9 shrink-0 rounded-lg border border-(--border) bg-(--surface) px-2.5 text-xs text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">
            All
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
          aria-label="Apply task filters"
          title="Apply filters"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <LoaderCircle
              size={13}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Search
              size={13}
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      {loadErrorMessage && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)"
        >
          {loadErrorMessage}
        </p>
      )}

      {actionErrorMessage && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)"
        >
          {actionErrorMessage}
        </p>
      )}

      {isLoading ? (
        <p
          role="status"
          className="mt-3 text-xs text-(--text-muted)"
        >
          Loading tasks...
        </p>
      ) : loadErrorMessage ? null : tasks.length === 0 ? (
        <p
          role="status"
          className="mt-3 px-1 text-xs text-(--text-muted)"
        >
          No tasks match the current filters.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="workspace"
              isMutating={isMutating}
              onUpdate={onUpdate}
              onStatusChange={
                onStatusChange
              }
              onDelete={onDelete}
              onOpenDetail={
                onOpenDetail
              }
            />
          ))}
        </div>
      )}
    </details>
  );
}
