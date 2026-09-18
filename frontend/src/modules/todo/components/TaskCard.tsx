import {
  Ellipsis,
  Eye,
  ExternalLink,
  Folder,
  FolderPen,
  Pencil,
  Tags,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useReverseContextNavigation } from "../../context/hooks/useReverseContextNavigation";
import {
  formatTaskSourceLabel,
  formatTaskStatusLabel,
} from "../presentation/taskLabels";
import type {
  Task,
  TaskStatus,
  UpdateTaskInput,
} from "../services/taskApi";

interface TaskCardProps {
  task: Task;
  variant?:
    | "default"
    | "workspace"
    | "planner";

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

  onOpenDetail?: (
    taskId: number,
  ) => void;

  onEditOrganization?: (
    task: Task,
  ) => void;

  isOrganizationDisabled?: boolean;
}

function getTaskStatusClassName(
  status: TaskStatus,
) {
  switch (status) {
    case "NOT_STARTED":
      return "bg-(--surface-hover) text-(--text-secondary)";
    case "IN_PROGRESS":
      return "bg-(--warning-surface) text-(--warning-text)";
    case "COMPLETED":
      return "bg-(--success-surface) text-(--success-text)";
  }
}

export function TaskCard({
  task,
  variant = "default",
  isMutating,
  onUpdate,
  onStatusChange,
  onDelete,
  onOpenDetail,
  onEditOrganization,
  isOrganizationDisabled = false,
}: TaskCardProps) {
  const isWorkspace =
    variant === "workspace";

  const isPlanner =
    variant === "planner";

  const isCompact =
    isWorkspace || isPlanner;

  const [
    plannerActionsOpen,
    setPlannerActionsOpen,
  ] = useState(false);

  const plannerActionsTriggerRef =
    useRef<HTMLButtonElement | null>(
      null,
    );

  const plannerActionsPanelRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const plannerActionsId =
    `planner-task-actions-${task.id}`;

  const [
    isEditing,
    setIsEditing,
  ] = useState(false);

  const [
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
  ] = useState(false);

  const [
    deleteErrorMessage,
    setDeleteErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [title, setTitle] =
    useState(task.title);

  const [
    description,
    setDescription,
  ] = useState(
    task.description ?? "",
  );

  const [
    deadline,
    setDeadline,
  ] = useState(
    task.deadline ?? "",
  );

  const { openTaskContext } =
    useReverseContextNavigation();

  useEffect(() => {
    if (!plannerActionsOpen) {
      return;
    }

    function handlePointerDown(
      event: PointerEvent,
    ) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (
        plannerActionsTriggerRef.current?.contains(
          event.target,
        ) ||
        plannerActionsPanelRef.current?.contains(
          event.target,
        )
      ) {
        return;
      }

      setPlannerActionsOpen(false);
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key !== "Escape") {
        return;
      }

      setPlannerActionsOpen(false);
      plannerActionsTriggerRef.current?.focus();
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );
    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [plannerActionsOpen]);

  function closePlannerActions() {
    setPlannerActionsOpen(false);
  }

  function handleStartEditing() {
    setTitle(
      task.title,
    );

    setDescription(
      task.description ?? "",
    );

    setDeadline(
      task.deadline ?? "",
    );

    setIsEditing(true);
  }

  function handleCancelEditing() {
    setTitle(
      task.title,
    );

    setDescription(
      task.description ?? "",
    );

    setDeadline(
      task.deadline ?? "",
    );

    setIsEditing(false);
  }

  async function handleSave() {
    const trimmedTitle =
      title.trim();

    if (
      !trimmedTitle ||
      isMutating
    ) {
      return;
    }

    try {
      await onUpdate(
        task.id,
        {
          title: trimmedTitle,
          description:
            description.trim() ||
            null,
          deadline:
            deadline || null,
        },
      );

      setIsEditing(false);
    } catch {
      /*
       * The parent page owns the API error message.
       * Keep the editor open so the user can correct
       * the submitted values.
       */
    }
  }

  async function confirmDelete() {
    if (isMutating) {
      return;
    }

    setDeleteErrorMessage(null);

    try {
      await onDelete(
        task.id,
      );

      setIsDeleteDialogOpen(
        false,
      );
    } catch (error) {
      setDeleteErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not delete Task.",
      );
    }
  }

  async function handleViewSource() {
    try {
      await openTaskContext(
        task.id,
      );
    } catch {
      /*
       * reverseContextStore keeps the API error.
       */
    }
  }

  return (
    <>
      <article
        className={`rounded-xl border border-(--border) bg-(--surface) transition-colors duration-150 hover:border-(--border-strong) hover:bg-(--surface-hover) ${
          isCompact
            ? "p-2.5"
            : "p-3"
        }`}
      >
        {isEditing ? (
          <div className="space-y-2">
            <label
              htmlFor={`task-title-${task.id}`}
              className="sr-only"
            >
              Task title
            </label>

            <input
              id={`task-title-${task.id}`}
              value={title}
              maxLength={255}
              disabled={isMutating}
              onChange={(event) =>
                setTitle(
                  event.target.value,
                )
              }
              placeholder="Task title"
              className={`w-full rounded-lg border border-(--border) bg-(--app-bg) px-3 py-2 text-sm outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 ${
                isCompact
                  ? "min-h-10"
                  : ""
              }`}
            />

            <label
              htmlFor={`task-description-${task.id}`}
              className="sr-only"
            >
              Task description
            </label>

            <textarea
              id={`task-description-${task.id}`}
              value={description}
              disabled={isMutating}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              placeholder="Description"
              className="h-20 w-full resize-none rounded-lg border border-(--border) bg-(--app-bg) px-3 py-2 text-xs outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
            />

            <label
              htmlFor={`task-deadline-${task.id}`}
              className="sr-only"
            >
              Task deadline
            </label>

            <input
              id={`task-deadline-${task.id}`}
              type="date"
              value={deadline}
              disabled={isMutating}
              onChange={(event) =>
                setDeadline(
                  event.target.value,
                )
              }
              className={`w-full rounded-lg border border-(--border) bg-(--app-bg) px-3 py-2 text-xs outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 ${
                isCompact
                  ? "min-h-10"
                  : ""
              }`}
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isMutating}
                onClick={
                  handleCancelEditing
                }
                className={`rounded-lg border border-(--border) px-2 py-1 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 ${
                  isCompact
                    ? "min-h-10 xl:min-h-8"
                    : ""
                }`}
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={
                  isMutating ||
                  !title.trim()
                }
                onClick={() =>
                  void handleSave()
                }
                className={`rounded-lg bg-(--primary-bg) px-3 py-1 text-xs font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 ${
                  isCompact
                    ? "min-h-10 xl:min-h-8"
                    : ""
                }`}
              >
                {isMutating
                  ? "Saving..."
                  : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="wrap-break-word text-sm font-medium text-(--text-primary)">
                  {task.title}
                </p>

                {variant === "default" &&
                  task.description && (
                  <p className="mt-1 whitespace-pre-wrap wrap-break-word text-xs leading-5 text-(--text-muted)">
                    {task.description}
                  </p>
                  )}
              </div>

              {isPlanner ? (
                <button
                  ref={plannerActionsTriggerRef}
                  type="button"
                  disabled={isMutating}
                  aria-label={`Actions for task ${task.title}`}
                  aria-expanded={plannerActionsOpen}
                  aria-controls={plannerActionsId}
                  onClick={() =>
                    setPlannerActionsOpen(
                      (open) => !open,
                    )
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                  title="Task actions"
                >
                  <Ellipsis
                    size={16}
                    aria-hidden="true"
                  />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={
                    handleStartEditing
                  }
                  aria-label={`Edit task ${task.title}`}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                  title="Edit task"
                >
                  <Pencil
                    size={13}
                    aria-hidden="true"
                  />
                </button>
              )}
            </div>

            {(task.category ||
              task.tags.length > 0) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-(--text-secondary)">
                {task.category && (
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-(--border) bg-(--app-bg) px-2 py-1">
                    <Folder
                      size={10}
                      className="shrink-0 text-(--text-muted)"
                      aria-hidden="true"
                    />
                    <span
                      className="truncate"
                      title={
                        task.category.name
                      }
                    >
                      {task.category.name}
                    </span>
                  </span>
                )}

                {task.tags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex max-w-full items-center gap-1 rounded-full bg-(--surface-hover) px-2 py-1"
                    title={tag.name}
                  >
                    <Tags
                      size={10}
                      className="shrink-0 text-(--text-muted)"
                      aria-hidden="true"
                    />
                    <span className="truncate">
                      {tag.name}
                    </span>
                  </span>
                ))}
              </div>
            )}

            {isPlanner &&
              plannerActionsOpen && (
                <div
                  ref={plannerActionsPanelRef}
                  id={plannerActionsId}
                  className="mt-2 grid gap-1 rounded-xl border border-(--border) bg-(--panel-bg) p-2 shadow-[var(--elevated-shadow)] sm:grid-cols-2"
                >
                  {onOpenDetail && (
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => {
                        closePlannerActions();
                        onOpenDetail(
                          task.id,
                        );
                      }}
                      className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Eye
                        size={13}
                        aria-hidden="true"
                      />
                      Details
                    </button>
                  )}

                  {task.sourceStatus ===
                    "HAS_SOURCE" && (
                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() => {
                        closePlannerActions();
                        void handleViewSource();
                      }}
                      className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ExternalLink
                        size={13}
                        aria-hidden="true"
                      />
                      Go to source
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => {
                      closePlannerActions();
                      handleStartEditing();
                    }}
                    className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Pencil
                      size={13}
                      aria-hidden="true"
                    />
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={isMutating}
                    onClick={() => {
                      closePlannerActions();
                      setDeleteErrorMessage(
                        null,
                      );
                      setIsDeleteDialogOpen(
                        true,
                      );
                    }}
                    className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-(--text-muted) transition hover:bg-(--danger-surface) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Trash2
                      size={13}
                      aria-hidden="true"
                    />
                    Delete
                  </button>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor={`planner-task-status-${task.id}`}
                      className="sr-only"
                    >
                      Task status
                    </label>

                    <select
                      id={`planner-task-status-${task.id}`}
                      value={task.status}
                      disabled={isMutating}
                      onChange={(event) => {
                        closePlannerActions();
                        void onStatusChange(
                          task.id,
                          event.target
                            .value as TaskStatus,
                        );
                      }}
                      className="min-h-10 w-full rounded-lg border border-(--border) bg-(--app-bg) px-2 py-2 text-xs leading-5 text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                    >
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
                  </div>
                </div>
              )}

            {isCompact ? (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span
                    className={`rounded-full px-2 py-1 font-medium ${getTaskStatusClassName(
                      task.status,
                    )}`}
                  >
                    {formatTaskStatusLabel(
                      task.status,
                    )}
                  </span>

                  <span
                    className={`rounded-full px-2 py-1 ${
                      task.sourceStatus ===
                      "SOURCE_MISSING"
                        ? "bg-(--danger-surface) text-(--danger-text)"
                        : task.sourceStatus ===
                            "HAS_SOURCE"
                          ? "bg-(--surface-hover) text-(--text-secondary)"
                          : "bg-(--surface-hover) text-(--text-muted)"
                    }`}
                  >
                    {formatTaskSourceLabel(task)}
                  </span>

                  {task.deadline && (
                    <span className="text-(--text-muted)">
                      Due {task.deadline}
                    </span>
                  )}
                </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span
                  className={`rounded-full px-2 py-1 font-medium ${getTaskStatusClassName(
                    task.status,
                  )}`}
                >
                  {formatTaskStatusLabel(
                    task.status,
                  )}
                </span>

                {task.deadline && (
                  <span className="rounded-full bg-(--surface-hover) px-2 py-1 text-(--text-secondary)">
                    Due {task.deadline}
                  </span>
                )}

                <span
                  className={`rounded-full px-2 py-1 ${
                    task.sourceStatus ===
                    "SOURCE_MISSING"
                      ? "bg-(--danger-surface) text-(--danger-text)"
                      : task.sourceStatus ===
                          "HAS_SOURCE"
                        ? "bg-(--surface-hover) text-(--text-secondary)"
                        : "bg-(--surface-hover) text-(--text-muted)"
                  }`}
                >
                  {formatTaskSourceLabel(task)}
                </span>
              </div>
            )}

            {!isPlanner && (
            <div
              className={`flex flex-wrap items-center gap-2 border-t border-(--border) ${
                isWorkspace
                  ? "mt-2 pt-2"
                  : "mt-3 pt-3"
              }`}
            >
              {onOpenDetail && (
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() =>
                    onOpenDetail(
                      task.id,
                    )
                  }
                  aria-label={
                    isWorkspace
                      ? `Open task ${task.title} details`
                      : undefined
                  }
                  className={
                    isWorkspace
                      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                      : "flex shrink-0 items-center gap-1 rounded-lg border border-(--border) px-2 py-1.5 text-xs text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                  }
                  title={
                    isWorkspace
                      ? "Task details"
                      : undefined
                  }
                >
                  <Eye
                    size={12}
                    aria-hidden="true"
                  />
                  {!isWorkspace &&
                    "Details"}
                </button>
              )}

              {task.sourceStatus ===
                "HAS_SOURCE" && (
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() =>
                    void handleViewSource()
                  }
                  aria-label={
                    isWorkspace
                      ? `Go to source for task ${task.title}`
                      : undefined
                  }
                  className={
                    isWorkspace
                      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                      : "flex shrink-0 items-center gap-1 rounded-lg border border-(--border) px-2 py-1.5 text-xs text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                  }
                  title="Go to source"
                >
                  <ExternalLink
                    size={12}
                    aria-hidden="true"
                  />

                  {!isWorkspace &&
                    "Go to source"}
                </button>
              )}

              {onEditOrganization && (
                <button
                  type="button"
                  disabled={
                    isMutating ||
                    isOrganizationDisabled
                  }
                  onClick={() =>
                    onEditOrganization(task)
                  }
                  className={
                    isWorkspace
                      ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                      : "flex shrink-0 items-center gap-1 rounded-lg border border-(--border) px-2 py-1.5 text-xs text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                  }
                  aria-label={
                    isWorkspace
                      ? `Organize task ${task.title}`
                      : undefined
                  }
                  title="Organize task"
                >
                  <FolderPen
                    size={12}
                    aria-hidden="true"
                  />
                  {!isWorkspace &&
                    "Organize"}
                </button>
              )}

              <label
                htmlFor={`task-status-${task.id}`}
                className="sr-only"
              >
                Task status
              </label>

              <select
                id={`task-status-${task.id}`}
                value={task.status}
                disabled={isMutating}
                onChange={(event) =>
                  void onStatusChange(
                    task.id,
                    event.target
                      .value as TaskStatus,
                  )
                }
                className={`rounded-lg border border-(--border) bg-(--app-bg) px-2 text-xs leading-5 text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 ${
                  isWorkspace
                    ? "h-10 min-w-32 flex-1 py-1 xl:h-9"
                    : "h-9 w-auto min-w-32 max-w-full py-1"
                }`}
              >
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
                disabled={isMutating}
                onClick={() => {
                  setDeleteErrorMessage(
                    null,
                  );
                  setIsDeleteDialogOpen(
                    true,
                  );
                }}
                aria-label={`Delete task ${task.title}`}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                title="Delete task"
              >
                <Trash2
                  size={13}
                  aria-hidden="true"
                />
              </button>
            </div>
            )}
          </>
        )}
      </article>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={`Delete task "${task.title}"?`}
        description={
          task.sourceStatus === "HAS_SOURCE"
            ? "Deleting the Task does not delete its source Note or exact source record."
            : "This will permanently delete the Task."
        }
        confirmLabel="Delete Task"
        isBusy={isMutating}
        errorMessage={
          deleteErrorMessage
        }
        onConfirm={
          confirmDelete
        }
        onCancel={() => {
          if (isMutating) {
            return;
          }

          setDeleteErrorMessage(
            null,
          );
          setIsDeleteDialogOpen(
            false,
          );
        }}
      />
    </>
  );
}
