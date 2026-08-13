import {
  CalendarDays,
  ChevronDown,
} from "lucide-react";

import type {
  DailyPlan,
  Task,
  TaskStatus,
  UpdateTaskInput,
} from "../services/taskApi";
import { TaskCard } from "./TaskCard";

interface TaskMutationHandlers {
  isMutating: boolean;

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

interface PlanSectionProps
  extends TaskMutationHandlers {
  title: string;
  tasks: Task[];
  emptyText: string;
}

function PlanSection({
  title,
  tasks,
  emptyText,
  isMutating,
  onUpdate,
  onStatusChange,
  onDelete,
}: PlanSectionProps) {
  return (
    <details
      open={tasks.length > 0}
      className="rounded-xl border border-(--border) bg-(--app-bg) p-3"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)">
        <span className="text-sm font-medium text-(--text-primary)">
          {title}
        </span>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-(--surface) px-2 py-1 text-[10px] text-(--text-muted)">
            {tasks.length}
          </span>

          <ChevronDown
            size={13}
            className="text-(--text-faint)"
            aria-hidden="true"
          />
        </div>
      </summary>

      {tasks.length === 0 ? (
        <p className="mt-3 text-xs text-(--text-faint)">
          {emptyText}
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

interface DailyPlanPanelProps
  extends TaskMutationHandlers {
  dailyPlan: DailyPlan | null;
  isLoadingPlan: boolean;
}

export function DailyPlanPanel({
  dailyPlan,
  isLoadingPlan,
  isMutating,
  onUpdate,
  onStatusChange,
  onDelete,
}: DailyPlanPanelProps) {
  const mutationProps = {
    isMutating,
    onUpdate,
    onStatusChange,
    onDelete,
  };

  return (
    <section
      aria-busy={isLoadingPlan}
      className="rounded-2xl border border-(--border) bg-(--app-bg) p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarDays
            size={16}
            className="text-(--text-muted)"
            aria-hidden="true"
          />

          <div>
            <h4 className="text-sm font-medium text-(--text-secondary)">
              Daily Plan
            </h4>

            <p className="mt-1 text-xs text-(--text-muted)">
              Derived from your current Tasks.
            </p>
          </div>
        </div>

        {dailyPlan && (
          <span className="rounded-full bg-(--surface) px-2 py-1 text-[10px] text-(--text-muted)">
            {dailyPlan.currentDate}
          </span>
        )}
      </div>

      {isLoadingPlan && !dailyPlan ? (
        <p
          role="status"
          className="mt-4 text-xs text-(--text-muted)"
        >
          Loading plan...
        </p>
      ) : !dailyPlan ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-dashed border-(--border) p-3 text-xs text-(--text-faint)"
        >
          Daily Plan is currently unavailable.
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          <PlanSection
            title="Overdue"
            tasks={dailyPlan.overdue}
            emptyText="No overdue tasks."
            {...mutationProps}
          />

          <PlanSection
            title="Today"
            tasks={dailyPlan.today}
            emptyText="Nothing due today."
            {...mutationProps}
          />

          <PlanSection
            title="Upcoming"
            tasks={dailyPlan.upcoming}
            emptyText="No upcoming tasks."
            {...mutationProps}
          />

          <PlanSection
            title="No deadline"
            tasks={dailyPlan.noDeadline}
            emptyText="No tasks without a deadline."
            {...mutationProps}
          />

          <PlanSection
            title="Completed"
            tasks={dailyPlan.completed}
            emptyText="No completed tasks."
            {...mutationProps}
          />

          <p className="pt-1 text-[10px] text-(--text-faint)">
            Time zone: {dailyPlan.timeZone}
          </p>
        </div>
      )}
    </section>
  );
}
