import {
  CalendarDays,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../../../lib/api";
import { TaskCard } from "../components/TaskCard";
import { TaskComposer } from "../components/TaskComposer";
import {
  createIndependentTask,
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
  id: string;
  title: string;
  description: string;
  tasks: Task[];
  emptyText: string;
  bounded?: boolean;
  tone?:
    | "default"
    | "primary"
    | "danger"
    | "secondary";

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

type PlanGroup =
  | "today"
  | "overdue"
  | "upcoming"
  | "no-deadline"
  | "completed";

type SecondaryPlanGroup = Extract<
  PlanGroup,
  | "upcoming"
  | "no-deadline"
  | "completed"
>;

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong.";
}

function formatPlannerDate(
  calendarDate: string,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      calendarDate,
    );

  if (!match) {
    return calendarDate;
  }

  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
    ),
  );

  return new Intl.DateTimeFormat(
    "en-US",
    {
      weekday: "long",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    },
  ).format(date);
}

function PlanSection({
  id,
  title,
  description,
  tasks,
  emptyText,
  bounded = false,
  tone = "default",
  isMutating,
  onUpdate,
  onStatusChange,
  onDelete,
  onOpenDetail,
}: PlanSectionProps) {
  const sectionClassName =
    tone === "primary"
      ? "border-(--border-strong) bg-(--surface)"
      : tone === "danger"
        ? "border-(--danger-border) bg-(--danger-surface)"
        : tone === "secondary"
          ? "border-(--border) bg-(--surface-subtle)"
          : "border-(--border) bg-(--app-bg)";

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`scroll-mt-4 rounded-xl border p-4 ${sectionClassName}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2
            id={`${id}-title`}
            className={`font-medium ${
              tone === "primary"
                ? "text-base text-(--text-primary)"
                : tone === "danger"
                  ? "text-sm text-(--danger-text)"
                  : "text-sm text-(--text-secondary)"
            }`}
          >
            {title}
          </h2>

          {tasks.length > 0 && (
            <p className="mt-1 text-xs leading-5 text-(--text-muted)">
              {description}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full border border-(--border) bg-(--surface) px-2 py-1 text-[10px] font-medium tabular-nums text-(--text-secondary)">
            {tasks.length}
          </span>
        </div>
      </div>

      {tasks.length === 0 ? (
        <p
          role="status"
          className="mt-4 flex min-h-20 items-center justify-center rounded-lg border border-dashed border-(--border) bg-(--surface) px-4 text-center text-xs leading-5 text-(--text-muted)"
        >
          {emptyText}
        </p>
      ) : (
        <div
          className={`mt-3 space-y-2 ${
            bounded
              ? "max-h-80 overflow-y-auto overscroll-contain pr-1"
              : ""
          }`}
        >
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              variant="planner"
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
    </section>
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
    loadErrorMessage,
    setLoadErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    actionErrorMessage,
    setActionErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    notice,
    setNotice,
  ] = useState<string | null>(
    null,
  );

  const [
    newTaskTitle,
    setNewTaskTitle,
  ] = useState("");

  const [
    newTaskDescription,
    setNewTaskDescription,
  ] = useState("");

  const [
    newTaskDeadline,
    setNewTaskDeadline,
  ] = useState("");

  const [
    createErrorMessage,
    setCreateErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    selectedSecondaryGroup,
    setSelectedSecondaryGroup,
  ] = useState<SecondaryPlanGroup>(
    "upcoming",
  );

  useEffect(() => {
    let cancelled = false;

    void getDailyPlan()
      .then((response) => {
        if (cancelled) {
          return;
        }

        setDailyPlan(response);
        setLoadErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadErrorMessage(
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
    setLoadErrorMessage(null);

    try {
      const response =
        await getDailyPlan();

      setDailyPlan(response);
      return true;
    } catch (error) {
      setLoadErrorMessage(
        getErrorMessage(error),
      );
      return false;
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
    setActionErrorMessage(null);
    setNotice(null);

    try {
      await updateTask(
        taskId,
        input,
      );
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
      setIsMutating(false);
      throw error;
    }

    /*
     * Deadline changes can move a Task between
     * Overdue / Today / Upcoming / No deadline.
     * Always reload the derived plan from Backend.
     */
    const refreshed =
      await reloadPlan();

    setNotice(
      refreshed
        ? "Task updated and Daily Plan regrouped."
        : "Task updated, but Daily Plan could not be refreshed.",
    );
    setIsMutating(false);
  }

  async function handleStatusChange(
    taskId: number,
    status: TaskStatus,
  ) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setActionErrorMessage(null);
    setNotice(null);

    try {
      await updateTaskStatus(
        taskId,
        status,
      );
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
      setIsMutating(false);
      return;
    }

    /*
     * Completed has grouping priority, so status
     * changes must be reflected by the Backend plan
     * instead of reclassified in the browser.
     */
    const refreshed =
      await reloadPlan();

    setNotice(
      refreshed
        ? "Task status updated and Daily Plan regrouped."
        : "Task status updated, but Daily Plan could not be refreshed.",
    );
    setIsMutating(false);
  }

  async function handleDelete(
    taskId: number,
  ) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setActionErrorMessage(null);
    setNotice(null);

    try {
      await deleteTask(taskId);
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
      setIsMutating(false);
      throw error;
    }

    const refreshed =
      await reloadPlan();

    setNotice(
      refreshed
        ? "Task deleted. Its Note and YouTube source were not deleted."
        : "Task deleted, but Daily Plan could not be refreshed.",
    );
    setIsMutating(false);
  }

  async function handleCreateTask() {
    const title =
      newTaskTitle.trim();

    if (
      !title ||
      isMutating
    ) {
      return;
    }

    setIsMutating(true);
    setActionErrorMessage(null);
    setCreateErrorMessage(null);
    setNotice(null);

    try {
      await createIndependentTask({
        title,
        description:
          newTaskDescription.trim() ||
          null,
        deadline:
          newTaskDeadline || null,
      });
    } catch (error) {
      setCreateErrorMessage(
        getErrorMessage(error),
      );
      setIsMutating(false);
      return;
    }

    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskDeadline("");

    /*
     * Daily Plan classification stays authoritative
     * on the Backend. Never place the new Task into
     * a date group locally.
     */
    const refreshed =
      await reloadPlan();

    setNotice(
      refreshed
        ? "Task created and Daily Plan regrouped."
        : "Task created, but Daily Plan could not be refreshed.",
    );
    setIsMutating(false);
  }

  const totalTasks =
    dailyPlan
      ? dailyPlan.overdue.length +
        dailyPlan.today.length +
        dailyPlan.upcoming.length +
        dailyPlan.noDeadline.length +
        dailyPlan.completed.length
      : 0;

  const selectedSecondaryPlan =
    dailyPlan
      ? selectedSecondaryGroup ===
        "upcoming"
        ? {
            id: "plan-upcoming",
            title: "Upcoming",
            description:
              "Incomplete Tasks whose deadline is after the current date.",
            tasks:
              dailyPlan.upcoming,
            emptyText:
              "No upcoming Tasks.",
          }
        : selectedSecondaryGroup ===
            "no-deadline"
          ? {
              id: "plan-no-deadline",
              title: "No deadline",
              description:
                "Incomplete Tasks that do not currently have a deadline.",
              tasks:
                dailyPlan.noDeadline,
              emptyText:
                "No Tasks without a deadline.",
            }
          : {
              id: "plan-completed",
              title: "Completed",
              description:
                "Completed Tasks are kept separate even when their deadline is in the past.",
              tasks:
                dailyPlan.completed,
              emptyText:
                "No completed Tasks.",
            }
      : null;

  function navigateToPlanGroup(
    group: PlanGroup,
  ) {
    if (
      group === "upcoming" ||
      group === "no-deadline" ||
      group === "completed"
    ) {
      setSelectedSecondaryGroup(
        group,
      );

      requestAnimationFrame(() => {
        document
          .getElementById(
            "plan-secondary",
          )
          ?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
      });
      return;
    }

    document
      .getElementById(
        `plan-${group}`,
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  function handleSecondaryTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentGroup: SecondaryPlanGroup,
  ) {
    const groups: SecondaryPlanGroup[] = [
      "upcoming",
      "no-deadline",
      "completed",
    ];
    const currentIndex =
      groups.indexOf(currentGroup);
    let nextIndex: number | null =
      null;

    if (
      event.key === "ArrowRight" ||
      event.key === "ArrowDown"
    ) {
      nextIndex =
        (currentIndex + 1) %
        groups.length;
    } else if (
      event.key === "ArrowLeft" ||
      event.key === "ArrowUp"
    ) {
      nextIndex =
        (currentIndex - 1 +
          groups.length) %
        groups.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex =
        groups.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();

    const nextGroup =
      groups[nextIndex];
    setSelectedSecondaryGroup(
      nextGroup,
    );

    requestAnimationFrame(() => {
      document
        .getElementById(
          `secondary-tab-${nextGroup}`,
        )
        ?.focus();
    });
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-4 border-b border-(--border) pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">
              Daily Plan
            </h1>

            <p className="mt-1 max-w-2xl text-sm leading-6 text-(--text-secondary)">
              A calm view of what needs attention today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {dailyPlan && (
              <p className="rounded-full border border-(--border) bg-(--surface) px-3 py-1.5 text-xs font-medium text-(--text-secondary)">
                {totalTasks} task{totalTasks === 1 ? "" : "s"}
              </p>
            )}

            <button
              type="button"
              onClick={() => {
                setActionErrorMessage(null);
                setNotice(null);
                void reloadPlan();
              }}
              disabled={
                isLoading ||
                isMutating
              }
              className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
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
          </div>
        </header>

        {dailyPlan && (
          <section className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-xl border border-(--border) bg-(--surface) px-4 py-3 text-sm text-(--text-muted)">
            <span className="flex items-center gap-2 font-medium text-(--text-primary)">
              <CalendarDays size={15} aria-hidden="true" />
              {formatPlannerDate(
                dailyPlan.currentDate,
              )}
            </span>
            <span className="text-(--text-muted)">{dailyPlan.timeZone}</span>
          </section>
        )}

        {dailyPlan && (
          <nav
            aria-label="Daily Plan groups"
            className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5"
          >
            <button
              type="button"
              onClick={() =>
                navigateToPlanGroup(
                  "today",
                )
              }
              className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-(--border-strong) bg-(--surface) px-3 text-sm font-medium text-(--text-primary) transition hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
            >
              Today
              <span className="rounded-full bg-(--surface-active) px-2 py-0.5 text-[10px] text-(--text-secondary)">
                {dailyPlan.today.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                navigateToPlanGroup(
                  "overdue",
                )
              }
              className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-(--danger-border) bg-(--danger-surface) px-3 text-sm font-medium text-(--danger-text) transition hover:border-(--border-strong) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
            >
              Overdue
              <span className="rounded-full bg-(--surface) px-2 py-0.5 text-[10px] text-(--text-muted)">
                {dailyPlan.overdue.length}
              </span>
            </button>

            {([
              [
                "upcoming",
                "Upcoming",
                dailyPlan.upcoming.length,
              ],
              [
                "no-deadline",
                "No deadline",
                dailyPlan.noDeadline.length,
              ],
              [
                "completed",
                "Completed",
                dailyPlan.completed.length,
              ],
            ] as const).map(
              ([group, label, count]) => (
                <button
                  key={group}
                  type="button"
                  onClick={() =>
                    navigateToPlanGroup(
                      group,
                    )
                  }
                  className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-(--border) bg-(--surface-subtle) px-3 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                >
                  {label}
                  <span className="rounded-full bg-(--surface) px-2 py-0.5 text-[10px] text-(--text-muted)">
                    {count}
                  </span>
                </button>
              ),
            )}
          </nav>
        )}

        <div className="mt-4">
          <TaskComposer
            notes={[]}
            title={newTaskTitle}
            description={
              newTaskDescription
            }
            deadline={
              newTaskDeadline
            }
            sourceNoteId=""
            allowSourceSelection={
              false
            }
            isMutating={
              isMutating
            }
            errorMessage={
              createErrorMessage
            }
            onTitleChange={
              setNewTaskTitle
            }
            onDescriptionChange={
              setNewTaskDescription
            }
            onDeadlineChange={
              setNewTaskDeadline
            }
            onSourceNoteIdChange={() => {}}
            onCreate={
              handleCreateTask
            }
          />
        </div>

        {loadErrorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) px-4 py-3 text-sm text-(--danger-text)"
          >
            {loadErrorMessage}
          </div>
        )}

        {actionErrorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) px-4 py-3 text-sm text-(--danger-text)"
          >
            {actionErrorMessage}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-(--border) bg-(--surface) px-4 py-3 text-sm text-(--text-secondary)"
          >
            {notice}
          </div>
        )}

        {isLoading &&
        !dailyPlan ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex min-h-64 items-center justify-center rounded-2xl border border-(--border) bg-(--surface)"
          >
            <div className="text-center">
              <LoaderCircle
                size={24}
                className="mx-auto animate-spin text-(--text-muted)"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm text-(--text-muted)">
                Loading Daily Plan...
              </p>
            </div>
          </div>
        ) : loadErrorMessage && !dailyPlan ? null : !dailyPlan ? (
          <div className="mt-6 rounded-2xl border border-dashed border-(--border) bg-(--app-bg) p-6 text-center">
            <p className="text-sm text-(--text-muted)">
              Daily Plan is currently unavailable.
            </p>
          </div>
        ) : totalTasks === 0 ? (
          <div className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-(--border) bg-(--app-bg) p-6 text-center">
            <div>
              <CalendarDays
                size={28}
                className="mx-auto text-(--text-faint)"
                aria-hidden="true"
              />

              <h2 className="mt-3 text-sm font-medium text-(--text-secondary)">
                No Tasks yet
              </h2>

              <p className="mt-2 max-w-md text-xs leading-5 text-(--text-muted)">
                Daily Plan is derived from existing Tasks. Create a Task first and it will appear in the appropriate group automatically.
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div className="grid items-start gap-4 lg:grid-cols-2">
              <PlanSection
                id="plan-today"
                title="Today"
                description="Incomplete Tasks due on the current date."
                tasks={dailyPlan.today}
                emptyText="Nothing is due today."
                tone="primary"
                bounded
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
                id="plan-overdue"
                title="Overdue"
                description="Incomplete Tasks whose deadline is before the current date."
                tasks={
                  dailyPlan.overdue
                }
                emptyText="No overdue Tasks."
                tone="danger"
                bounded
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

            <section
              id="plan-secondary"
              aria-labelledby="secondary-planner-title"
              className="scroll-mt-4 rounded-xl border border-(--border) bg-(--surface-subtle) p-4"
            >
              <h2
                id="secondary-planner-title"
                className="text-sm font-medium text-(--text-secondary)"
              >
                Other tasks
              </h2>

              <div
                role="tablist"
                aria-label="Secondary Daily Plan groups"
                className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3"
              >
                {([
                  [
                    "upcoming",
                    "Upcoming",
                    dailyPlan.upcoming.length,
                  ],
                  [
                    "no-deadline",
                    "No deadline",
                    dailyPlan.noDeadline.length,
                  ],
                  [
                    "completed",
                    "Completed",
                    dailyPlan.completed.length,
                  ],
                ] as const).map(
                  ([group, label, count]) => (
                    <button
                      key={group}
                      id={`secondary-tab-${group}`}
                      type="button"
                      role="tab"
                      aria-selected={
                        selectedSecondaryGroup ===
                        group
                      }
                      aria-controls="secondary-plan-panel"
                      tabIndex={
                        selectedSecondaryGroup ===
                        group
                          ? 0
                          : -1
                      }
                      onClick={() =>
                        setSelectedSecondaryGroup(
                          group,
                        )
                      }
                      onKeyDown={(event) =>
                        handleSecondaryTabKeyDown(
                          event,
                          group,
                        )
                      }
                      className={`flex min-h-10 items-center justify-between gap-2 rounded-lg border px-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${
                        selectedSecondaryGroup ===
                        group
                          ? "border-(--border-strong) bg-(--surface) font-medium text-(--text-primary)"
                          : "border-transparent text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary)"
                      }`}
                    >
                      {label}
                      <span className="rounded-full bg-(--surface-hover) px-2 py-0.5 text-[10px] text-(--text-muted)">
                        {count}
                      </span>
                    </button>
                  ),
                )}
              </div>

              {selectedSecondaryPlan && (
                <div
                  id="secondary-plan-panel"
                  role="tabpanel"
                  aria-labelledby={`secondary-tab-${selectedSecondaryGroup}`}
                  className="mt-3"
                >
                  <PlanSection
                    id={
                      selectedSecondaryPlan.id
                    }
                    title={
                      selectedSecondaryPlan.title
                    }
                    description={
                      selectedSecondaryPlan.description
                    }
                    tasks={
                      selectedSecondaryPlan.tasks
                    }
                    emptyText={
                      selectedSecondaryPlan.emptyText
                    }
                    tone="secondary"
                    bounded
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
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
