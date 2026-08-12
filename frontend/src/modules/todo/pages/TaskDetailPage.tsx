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
          className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700"
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
            className="mt-6 flex min-h-64 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900"
          >
            <div className="text-center">
              <LoaderCircle
                size={24}
                className="mx-auto animate-spin text-neutral-500"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm text-neutral-500">
                Loading Task...
              </p>
            </div>
          </div>
        ) : errorMessage &&
          !task ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-5"
          >
            <h1 className="text-lg font-semibold text-red-200">
              Could not load Task
            </h1>

            <p className="mt-2 text-sm text-red-300/80">
              {errorMessage}
            </p>
          </div>
        ) : task ? (
          <>
            <header className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">
                Task detail
              </p>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="wrap-break-word text-2xl font-semibold">
                    {task.title}
                  </h1>

                  <p className="mt-2 text-sm text-neutral-500">
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
                    className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="flex items-center gap-2 rounded-xl border border-red-950/70 px-3 py-2 text-sm text-red-300 transition hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-900 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300"
              >
                {errorMessage}
              </div>
            )}

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
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
                    className="mt-1 w-full rounded-lg border border-neutral-800 bg-neutral-950 py-1.5 text-sm text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
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

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Deadline
                  </p>

                  <p className="mt-2 text-sm text-neutral-300">
                    {task.deadline ??
                      "No deadline"}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Source
                  </p>

                  <p
                    className={`mt-2 text-sm ${
                      task.sourceStatus ===
                      "SOURCE_MISSING"
                        ? "text-red-300"
                        : "text-neutral-300"
                    }`}
                  >
                    {formatSourceLabel(
                      task,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Created
                  </p>

                  <p className="mt-2 text-sm text-neutral-300">
                    {formatDateTime(
                      task.createdAt,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Updated
                  </p>

                  <p className="mt-2 text-sm text-neutral-300">
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
                        className="text-xs font-medium uppercase tracking-wider text-neutral-600"
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
                        className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-200 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="task-detail-description"
                        className="text-xs font-medium uppercase tracking-wider text-neutral-600"
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
                        className="mt-2 min-h-36 w-full resize-y rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm leading-6 text-neutral-200 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="task-detail-deadline"
                        className="text-xs font-medium uppercase tracking-wider text-neutral-600"
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
                        className="mt-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2.5 text-sm text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                      />
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={
                          handleCancelEdit
                        }
                        disabled={isMutating}
                        className="rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-400 transition hover:bg-neutral-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
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
                        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
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
                      <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">
                        Description
                      </p>

                      <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-neutral-300">
                        {task.description ??
                          "No description"}
                      </p>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                          Current status
                        </p>

                        <p className="mt-1 text-sm text-neutral-300">
                          {formatStatusLabel(
                            task.status,
                          )}
                        </p>
                      </div>

                      <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                        <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                          Source state
                        </p>

                        <p className="mt-1 text-sm text-neutral-300">
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