import { ChevronDown } from "lucide-react";

import type {
  Task,
  TaskStatus,
  UpdateTaskInput,
} from "../services/taskApi";
import { TaskCard } from "./TaskCard";

interface TaskListPanelProps {
  tasks: Task[];
  totalElements: number;
  isLoading: boolean;
  isMutating: boolean;
  loadErrorMessage?: string | null;
  onUpdate: (taskId: number, input: UpdateTaskInput) => Promise<void>;
  onStatusChange: (taskId: number, status: TaskStatus) => Promise<void>;
  onDelete: (taskId: number) => Promise<void>;
  onOpenDetail: (taskId: number) => void;
}

export function TaskListPanel({
  tasks,
  totalElements,
  isLoading,
  isMutating,
  loadErrorMessage,
  onUpdate,
  onStatusChange,
  onDelete,
  onOpenDetail,
}: TaskListPanelProps) {
  return (
    <details aria-busy={isLoading} className="group mt-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-xs font-medium text-(--text-muted) outline-none transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus)">
        <span>Recent tasks · {isLoading ? "—" : totalElements}</span>
        <ChevronDown
          size={14}
          className="shrink-0 text-(--text-faint) transition-transform duration-150 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>

      {loadErrorMessage && (
        <p role="alert" className="mt-3 rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)">
          {loadErrorMessage}
        </p>
      )}
      {isLoading ? (
        <p role="status" className="mt-3 px-1 text-xs text-(--text-muted)">Loading recent tasks...</p>
      ) : loadErrorMessage ? null : tasks.length === 0 ? (
        <p role="status" className="mt-3 px-1 text-xs text-(--text-muted)">No tasks yet.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="workspace"
              isMutating={isMutating}
              onUpdate={onUpdate}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
              onOpenDetail={onOpenDetail}
            />
          ))}
        </div>
      )}
    </details>
  );
}
