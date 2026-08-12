import {
  CalendarDays,
  ChevronDown,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../../../lib/api";
import { TaskCard } from "../components/TaskCard";
import {
  deleteTask,
  getDailyPlan,
  updateTask,
  updateTaskStatus,
  type DailyPlan,
  type Task,
  type TaskStatus,
  type UpdateTaskInput,
} from "../services/taskApi";

interface PlanSectionProps {
  title: string;
  description: string;
  tasks: Task[];
  emptyText: string;

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

  onOpenDetail: (
    taskId: number,
  ) => void;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong.";
}

function PlanSection({
  title,
  description,
  tasks,
  emptyText,
  isMutating,
  onUpdate,
  onStatusChange,
  onDelete,
  onOpenDetail,
}: PlanSectionProps) {
  return (
    <details
      open={tasks.length > 0}
      className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
    >
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-neutral-300">
            {title}
          </h2>

          <p className="mt-1 text-xs leading-5 text-neutral-600">
            {description}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-neutral-900 px-2 py-1 text-[10px] text-neutral-500">
            {tasks.length}
          </span>

          <ChevronDown
            size={14}
            className="text-neutral-600"
            aria-hidden="true"
          />
        </div>
      </summary>

      {tasks.length === 0 ? (
        <p
          role="status"
          className="mt-4 rounded-xl border border-dashed border-neutral-800 p-4 text-xs text-neutral-600"
        >
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isMutating={
                isMutating
              }
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

export function DailyPlanPage() {
  const navigate = useNavigate();

  const [
    dailyPlan,
    setDailyPlan,
  ] = useState<DailyPlan | null>(
    null,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isMutating,
    setIsMutating,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    notice,
    setNotice,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    void getDailyPlan()
      .then((response) => {
        if (cancelled) {
          return;
        }

        setDailyPlan(response);
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          getErrorMessage(error),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function reloadPlan() {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response =
        await getDailyPlan();

      setDailyPlan(response);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUpdate(
    taskId: number,
    input: UpdateTaskInput,
  ) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      await updateTask(
        taskId,
        input,
      );

      /*
       * Deadline changes can move a Task between
       * Overdue / Today / Upcoming / No deadline.
       * Always reload the derived plan from Backend.
       */
      await reloadPlan();

      setNotice(
        "Task updated and Daily Plan regrouped.",
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  async function handleStatusChange(
    taskId: number,
    status: TaskStatus,
  ) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      await updateTaskStatus(
        taskId,
        status,
      );

      /*
       * Completed has grouping priority, so status
       * changes must be reflected by the Backend plan
       * instead of reclassified in the browser.
       */
      await reloadPlan();

      setNotice(
        "Task status updated and Daily Plan regrouped.",
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDelete(
    taskId: number,
  ) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);
    setNotice(null);

    try {
      await deleteTask(taskId);

      await reloadPlan();

      setNotice(
        "Task deleted. Its Note and YouTube source were not deleted.",
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  const totalTasks =
    dailyPlan
      ? dailyPlan.overdue.length +
        dailyPlan.today.length +
        dailyPlan.upcoming.length +
        dailyPlan.noDeadline.length +
        dailyPlan.completed.length
      : 0;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">
              Derived Task view
            </p>

            <h1 className="mt-2 text-2xl font-semibold">
              Daily Plan
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
              Daily Plan does not create separate Tasks. It groups your existing Tasks by their current status and deadline.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void reloadPlan()
            }
            disabled={
              isLoading ||
              isMutating
            }
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                isLoading
                  ? "animate-spin"
                  : ""
              }
              aria-hidden="true"
            />
            Refresh
          </button>
        </header>

        {dailyPlan && (
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-center gap-2 text-neutral-500">
                <CalendarDays
                  size={15}
                  aria-hidden="true"
                />

                <p className="text-[10px] font-medium uppercase tracking-wide">
                  Current date
                </p>
              </div>

              <p className="mt-2 text-sm text-neutral-200">
                {dailyPlan.currentDate}
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                Time zone
              </p>

              <p className="mt-2 wrap-break-word text-sm text-neutral-200">
                {dailyPlan.timeZone}
              </p>
            </div>

            <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-500">
                Tasks in plan
              </p>

              <p className="mt-2 text-sm text-neutral-200">
                {totalTasks}
              </p>
            </div>
          </section>
        )}

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-300"
          >
            {notice}
          </div>
        )}

        {isLoading &&
        !dailyPlan ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex min-h-64 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900"
          >
            <div className="text-center">
              <LoaderCircle
                size={24}
                className="mx-auto animate-spin text-neutral-500"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm text-neutral-500">
                Loading Daily Plan...
              </p>
            </div>
          </div>
        ) : !dailyPlan ? (
          <div className="mt-6 rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 p-6 text-center">
            <p className="text-sm text-neutral-500">
              Daily Plan is currently unavailable.
            </p>
          </div>
        ) : totalTasks === 0 ? (
          <div className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 p-6 text-center">
            <div>
              <CalendarDays
                size={28}
                className="mx-auto text-neutral-700"
                aria-hidden="true"
              />

              <h2 className="mt-3 text-sm font-medium text-neutral-300">
                No Tasks yet
              </h2>

              <p className="mt-2 max-w-md text-xs leading-5 text-neutral-500">
                Daily Plan is derived from existing Tasks. Create a Task first and it will appear in the appropriate group automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            <PlanSection
              title="Overdue"
              description="Incomplete Tasks whose deadline is before the current date."
              tasks={
                dailyPlan.overdue
              }
              emptyText="No overdue Tasks."
              isMutating={
                isMutating
              }
              onUpdate={
                handleUpdate
              }
              onStatusChange={
                handleStatusChange
              }
              onDelete={
                handleDelete
              }
              onOpenDetail={(
                taskId,
              ) =>
                navigate(
                  `/tasks/${taskId}`,
                )
              }
            />

            <PlanSection
              title="Today"
              description="Incomplete Tasks due on the current date."
              tasks={dailyPlan.today}
              emptyText="Nothing is due today."
              isMutating={
                isMutating
              }
              onUpdate={
                handleUpdate
              }
              onStatusChange={
                handleStatusChange
              }
              onDelete={
                handleDelete
              }
              onOpenDetail={(
                taskId,
              ) =>
                navigate(
                  `/tasks/${taskId}`,
                )
              }
            />

            <PlanSection
              title="Upcoming"
              description="Incomplete Tasks whose deadline is after the current date."
              tasks={
                dailyPlan.upcoming
              }
              emptyText="No upcoming Tasks."
              isMutating={
                isMutating
              }
              onUpdate={
                handleUpdate
              }
              onStatusChange={
                handleStatusChange
              }
              onDelete={
                handleDelete
              }
              onOpenDetail={(
                taskId,
              ) =>
                navigate(
                  `/tasks/${taskId}`,
                )
              }
            />

            <PlanSection
              title="No deadline"
              description="Incomplete Tasks that do not currently have a deadline."
              tasks={
                dailyPlan.noDeadline
              }
              emptyText="No Tasks without a deadline."
              isMutating={
                isMutating
              }
              onUpdate={
                handleUpdate
              }
              onStatusChange={
                handleStatusChange
              }
              onDelete={
                handleDelete
              }
              onOpenDetail={(
                taskId,
              ) =>
                navigate(
                  `/tasks/${taskId}`,
                )
              }
            />

            <PlanSection
              title="Completed"
              description="Completed Tasks are kept separate even when their deadline is in the past."
              tasks={
                dailyPlan.completed
              }
              emptyText="No completed Tasks."
              isMutating={
                isMutating
              }
              onUpdate={
                handleUpdate
              }
              onStatusChange={
                handleStatusChange
              }
              onDelete={
                handleDelete
              }
              onOpenDetail={(
                taskId,
              ) =>
                navigate(
                  `/tasks/${taskId}`,
                )
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}