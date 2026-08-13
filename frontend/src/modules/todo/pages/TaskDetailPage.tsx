import {
  ArrowLeft,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ApiError } from "../../../lib/api";
import {
  useReverseContextNavigation,
} from "../../context/hooks/useReverseContextNavigation";
import {
  deleteTask,
  getTask,
  updateTask,
  updateTaskStatus,
  type Task,
  type TaskStatus,
} from "../services/taskApi";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong.";
}

function formatDateTime(
  value: string,
) {
  const parsed = new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(parsed);
}

function formatSourceLabel(task: Task) {
  switch (task.sourceStatus) {
    case "HAS_SOURCE":
      return task.sourceNoteId
        ? `Note #${task.sourceNoteId}`
        : "Note source";

    case "SOURCE_MISSING":
      return "Source missing";

    default:
      return "Independent";
  }
}

function formatStatusLabel(
  status: TaskStatus,
) {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "IN_PROGRESS":
      return "In progress";
    case "COMPLETED":
      return "Completed";
  }
}

export function TaskDetailPage() {
  const navigate = useNavigate();
  const { taskId } = useParams();

  const parsedTaskId =
    Number(taskId);

  const isValidTaskId =
    Number.isSafeInteger(
      parsedTaskId,
    ) &&
    parsedTaskId > 0;

  const {
    openTaskContext,
  } =
    useReverseContextNavigation();

  const [
    task,
    setTask,
  ] = useState<Task | null>(
    null,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(
    isValidTaskId,
  );

  const [
    isMutating,
    setIsMutating,
  ] = useState(false);

  const [
    isEditing,
    setIsEditing,
  ] = useState(false);

  const [
    title,
    setTitle,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    deadline,
    setDeadline,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

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

  useEffect(() => {
    if (!isValidTaskId) {
      return;
    }

    let cancelled = false;

    void getTask(parsedTaskId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setTask(response);
        setTitle(response.title);
        setDescription(
          response.description ?? "",
        );
        setDeadline(
          response.deadline ?? "",
        );
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
  }, [
    isValidTaskId,
    parsedTaskId,
  ]);

  if (!isValidTaskId) {
    return (
      <Navigate
        to="/tasks"
        replace
      />
    );
  }

  function handleStartEdit() {
    if (!task) {
      return;
    }

    setTitle(task.title);
    setDescription(
      task.description ?? "",
    );
    setDeadline(
      task.deadline ?? "",
    );
    setErrorMessage(null);
    setIsEditing(true);
  }

  function handleCancelEdit() {
    if (!task) {
      return;
    }

    setTitle(task.title);
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
      !task ||
      isMutating ||
      !trimmedTitle
    ) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const updated =
        await updateTask(
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

      setTask(updated);
      setTitle(updated.title);
      setDescription(
        updated.description ?? "",
      );
      setDeadline(
        updated.deadline ?? "",
      );
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleStatusChange(
    nextStatus: TaskStatus,
  ) {
    if (
      !task ||
      isMutating ||
      nextStatus === task.status
    ) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const updated =
        await updateTaskStatus(
          task.id,
          nextStatus,
        );

      setTask(updated);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleViewSource() {
    if (!task) {
      return;
    }

    setErrorMessage(null);

    try {
      await openTaskContext(
        task.id,
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    }
  }

  async function handleDelete() {
    if (
      !task ||
      isMutating
    ) {
      return;
    }

    setIsMutating(true);
    setDeleteErrorMessage(null);

    try {
      await deleteTask(task.id);

      navigate("/tasks", {
        replace: true,
      });
    } catch (error) {
      setDeleteErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() =>
            navigate("/tasks")
          }
          className="flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
        >
          <ArrowLeft
            size={15}
            aria-hidden="true"
          />
          Back to Tasks
        </button>

        {isLoading ? (
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
                Loading Task...
              </p>
            </div>
          </div>
        ) : errorMessage &&
          !task ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-(--danger-border) bg-(--danger-surface) p-5"
          >
            <h1 className="text-lg font-semibold text-(--danger-text)">
              Could not load Task
            </h1>

            <p className="mt-2 text-sm text-(--danger-text)">
              {errorMessage}
            </p>
          </div>
        ) : task ? (
          <>
            <header className="mt-6">
              <p className="text-xs font-medium text-(--text-secondary)">
                Task detail
              </p>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="wrap-break-word text-2xl font-semibold">
                    {task.title}
                  </h1>

                  <p className="mt-2 text-sm text-(--text-muted)">
                    Task #{task.id}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void handleViewSource()
                    }
                    disabled={isMutating}
                    className="flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ExternalLink
                      size={14}
                      aria-hidden="true"
                    />
                    View Source
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleStartEdit
                    }
                    disabled={
                      isMutating ||
                      isEditing
                    }
                    className="flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pencil
                      size={14}
                      aria-hidden="true"
                    />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDeleteErrorMessage(
                        null,
                      );
                      setIsDeleteDialogOpen(
                        true,
                      );
                    }}
                    disabled={isMutating}
                    className="flex items-center gap-2 rounded-xl border border-(--danger-border) px-3 py-2 text-sm text-(--danger-text) transition hover:bg-(--danger-surface) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--danger-ring) disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2
                      size={14}
                      aria-hidden="true"
                    />
                    Delete
                  </button>
                </div>
              </div>
            </header>

            {errorMessage && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) px-4 py-3 text-sm text-(--danger-text)"
              >
                {errorMessage}
              </div>
            )}

            <section className="mt-6 rounded-2xl border border-(--border) bg-(--surface) p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
                  <p className="text-[11px] font-medium text-(--text-faint)">
                    Status
                  </p>

                  <label
                    htmlFor="task-detail-status"
                    className="sr-only"
                  >
                    Task status
                  </label>

                  <select
                    id="task-detail-status"
                    value={task.status}
                    disabled={isMutating}
                    onChange={(event) =>
                      void handleStatusChange(
                        event.target
                          .value as TaskStatus,
                      )
                    }
                    className="mt-1 w-full rounded-lg border border-(--border) bg-(--app-bg) py-1.5 text-sm text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
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

                <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
                  <p className="text-[11px] font-medium text-(--text-faint)">
                    Deadline
                  </p>

                  <p className="mt-2 text-sm text-(--text-secondary)">
                    {task.deadline ??
                      "No deadline"}
                  </p>
                </div>

                <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
                  <p className="text-[11px] font-medium text-(--text-faint)">
                    Source
                  </p>

                  <p
                    className={`mt-2 text-sm ${
                      task.sourceStatus ===
                      "SOURCE_MISSING"
                        ? "text-(--danger-text)"
                        : "text-(--text-secondary)"
                    }`}
                  >
                    {formatSourceLabel(
                      task,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
                  <p className="text-[11px] font-medium text-(--text-faint)">
                    Created
                  </p>

                  <p className="mt-2 text-sm text-(--text-secondary)">
                    {formatDateTime(
                      task.createdAt,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
                  <p className="text-[11px] font-medium text-(--text-faint)">
                    Updated
                  </p>

                  <p className="mt-2 text-sm text-(--text-secondary)">
                    {formatDateTime(
                      task.updatedAt,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                {isEditing ? (
                  <div className="space-y-3">
                    <div>
                      <label
                        htmlFor="task-detail-title"
                        className="text-xs font-medium text-(--text-secondary)"
                      >
                        Title
                      </label>

                      <input
                        id="task-detail-title"
                        value={title}
                        maxLength={255}
                        disabled={isMutating}
                        onChange={(event) =>
                          setTitle(
                            event.target.value,
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-(--border) bg-(--app-bg) px-3 py-2.5 text-sm text-(--text-primary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="task-detail-description"
                        className="text-xs font-medium text-(--text-secondary)"
                      >
                        Description
                      </label>

                      <textarea
                        id="task-detail-description"
                        value={description}
                        disabled={isMutating}
                        onChange={(event) =>
                          setDescription(
                            event.target.value,
                          )
                        }
                        className="mt-2 min-h-36 w-full resize-y rounded-xl border border-(--border) bg-(--app-bg) p-3 text-sm leading-6 text-(--text-primary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="task-detail-deadline"
                        className="text-xs font-medium text-(--text-secondary)"
                      >
                        Deadline
                      </label>

                      <input
                        id="task-detail-deadline"
                        type="date"
                        value={deadline}
                        disabled={isMutating}
                        onChange={(event) =>
                          setDeadline(
                            event.target.value,
                          )
                        }
                        className="mt-2 rounded-xl border border-(--border) bg-(--app-bg) px-3 py-2.5 text-sm text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={
                          handleCancelEdit
                        }
                        disabled={isMutating}
                        className="rounded-xl border border-(--border) px-4 py-2 text-sm text-(--text-secondary) transition hover:bg-(--app-bg) hover:text-(--text-primary) disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleSave()
                        }
                        disabled={
                          isMutating ||
                          !title.trim()
                        }
                        className="rounded-xl bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isMutating
                          ? "Saving..."
                          : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-xs font-medium text-(--text-secondary)">
                        Description
                      </p>

                      <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-(--text-secondary)">
                        {task.description ??
                          "No description"}
                      </p>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
                        <p className="text-[11px] font-medium text-(--text-faint)">
                          Current status
                        </p>

                        <p className="mt-1 text-sm text-(--text-secondary)">
                          {formatStatusLabel(
                            task.status,
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
                        <p className="text-[11px] font-medium text-(--text-faint)">
                          Source state
                        </p>

                        <p className="mt-1 text-sm text-(--text-secondary)">
                          {task.sourceStatus}
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={
          task
            ? `Delete task "${task.title}"?`
            : "Delete Task?"
        }
        description={
          task?.sourceStatus ===
          "HAS_SOURCE"
            ? "Deleting this Task does not delete its source Note or YouTube source."
            : "This permanently deletes the Task."
        }
        confirmLabel="Delete Task"
        isBusy={isMutating}
        errorMessage={
          deleteErrorMessage
        }
        onConfirm={
          handleDelete
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
    </main>
  );
}
