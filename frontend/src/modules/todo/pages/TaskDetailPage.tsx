import {
  ArrowLeft,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ApiError } from "../../../lib/api";
import { formatTime } from "../../../utils/formatTime";
import {
  useReverseContextNavigation,
} from "../../context/hooks/useReverseContextNavigation";
import { ImagePreview } from "../../images/components/ImagePreview";
import { AudioPlayer } from "../../audio/components/AudioPlayer";
import { getAudioPlaybackUrl } from "../../audio/services/audioApi";
import {
  getNote,
  getNoteSourceTitle,
  type Note,
} from "../../notes/services/noteApi";
import {
  deleteTask,
  getTask,
  updateTask,
  updateTaskStatus,
  type Task,
  type TaskStatus,
} from "../services/taskApi";
import {
  formatTaskSourceLabel,
} from "../presentation/taskLabels";

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

  const [
    sourceNote,
    setSourceNote,
  ] = useState<Note | null>(
    null,
  );

  const [
    isSourceNoteLoading,
    setIsSourceNoteLoading,
  ] = useState(false);

  const [
    sourceNoteErrorMessage,
    setSourceNoteErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    sourceNoteRetryToken,
    setSourceNoteRetryToken,
  ] = useState(0);

  const sourceNoteRequestId =
    useRef(0);

  const validSourceNoteId =
    task?.sourceStatus ===
      "HAS_SOURCE" &&
    task.sourceNoteId !== null &&
    Number.isSafeInteger(
      task.sourceNoteId,
    ) &&
    task.sourceNoteId > 0
      ? task.sourceNoteId
      : null;

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

  useEffect(() => {
    const requestId =
      ++sourceNoteRequestId.current;

    void Promise.resolve().then(
      async () => {
        if (
          requestId !==
          sourceNoteRequestId.current
        ) {
          return;
        }

        setSourceNote(null);
        setSourceNoteErrorMessage(
          null,
        );

        if (validSourceNoteId === null) {
          setIsSourceNoteLoading(
            false,
          );
          return;
        }

        setIsSourceNoteLoading(true);

        try {
          const response =
            await getNote(
              validSourceNoteId,
            );

          if (
            requestId ===
            sourceNoteRequestId.current
          ) {
            setSourceNote(response);
          }
        } catch {
          if (
            requestId ===
            sourceNoteRequestId.current
          ) {
            setSourceNoteErrorMessage(
              "Could not load source note details.",
            );
          }
        } finally {
          if (
            requestId ===
            sourceNoteRequestId.current
          ) {
            setIsSourceNoteLoading(
              false,
            );
          }
        }
      },
    );
  }, [
    validSourceNoteId,
    sourceNoteRetryToken,
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

              <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <h1 className="min-w-0 wrap-break-word text-2xl font-semibold">
                  {task.title}
                </h1>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleStartEdit}
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

            <section className="mt-6 rounded-2xl border border-(--border) bg-(--surface) p-4 sm:p-5">
              {isEditing ? (
                <div className="space-y-4">
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
                </div>
              ) : (
                <div>
                  <h2 className="text-xs font-medium text-(--text-secondary)">
                    Description
                  </h2>

                  <p className="mt-2 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-(--text-secondary)">
                    {task.description ??
                      "No description"}
                  </p>
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
                  <label
                    htmlFor="task-detail-status"
                    className="text-[11px] font-medium text-(--text-muted)"
                  >
                    Status
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
                    className="mt-2 h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-1 text-sm leading-5 text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
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
                  <label
                    htmlFor="task-detail-deadline"
                    className="text-[11px] font-medium text-(--text-muted)"
                  >
                    Deadline
                  </label>

                  {isEditing ? (
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
                      className="mt-2 h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-1 text-sm leading-5 text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
                    />
                  ) : (
                    <p className="mt-3 text-sm text-(--text-secondary)">
                      {task.deadline ??
                        "No deadline"}
                    </p>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="mt-4 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isMutating}
                    className="rounded-xl border border-(--border) px-4 py-2 text-sm text-(--text-secondary) transition hover:bg-(--app-bg) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
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
                    className="rounded-xl bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isMutating
                      ? "Saving..."
                      : "Save"}
                  </button>
                </div>
              )}
            </section>

            <section
              aria-busy={isSourceNoteLoading}
              className={`mt-4 rounded-2xl border p-4 sm:p-5 ${
                task.sourceStatus ===
                "SOURCE_MISSING"
                  ? "border-(--danger-border) bg-(--danger-surface)"
                  : "border-(--border) bg-(--surface)"
              }`}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                Source context
              </p>

              {task.sourceStatus ===
              "HAS_SOURCE" ? (
                <>
                  <h2 className="mt-2 text-sm font-semibold text-(--text-primary)">
                    {formatTaskSourceLabel(task)}
                  </h2>

                  {isSourceNoteLoading ? (
                    <div
                      role="status"
                      className="mt-4 flex min-h-20 items-center justify-center gap-2 text-sm text-(--text-muted)"
                    >
                      <LoaderCircle
                        size={16}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                      Loading source note...
                    </div>
                  ) : sourceNoteErrorMessage ||
                    validSourceNoteId ===
                      null ? (
                    <div className="mt-3 rounded-xl border border-(--danger-border) bg-(--danger-surface) p-3">
                      <p
                        role="alert"
                        className="text-sm text-(--danger-text)"
                      >
                        {sourceNoteErrorMessage ??
                          "Could not load source note details."}
                      </p>

                      {validSourceNoteId !==
                        null && (
                        <button
                          type="button"
                          onClick={() =>
                            setSourceNoteRetryToken(
                              (value) =>
                                value + 1,
                            )
                          }
                          className="mt-3 rounded-lg border border-(--danger-border) px-3 py-2 text-xs font-medium text-(--danger-text) transition hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  ) : sourceNote ? (
                    <div className="mt-3 min-w-0">
                      <p className="whitespace-pre-wrap wrap-break-word text-sm leading-7 text-(--text-secondary)">
                        {sourceNote.content}
                      </p>

                      <div className="mt-4 rounded-xl border border-(--border) bg-(--app-bg) p-3">
                        <p className="wrap-break-word text-sm font-medium text-(--text-primary)">
                          {getNoteSourceTitle(sourceNote)}
                        </p>

                        {sourceNote.youtubeSource?.channelName && (
                          <p className="mt-1 text-xs text-(--text-muted)">
                            {
                              sourceNote
                                .youtubeSource
                                .channelName
                            }
                          </p>
                        )}

                        {sourceNote.sourceType === "IMAGE" &&
                          sourceNote.imageSource && (
                          <div className="mt-3 max-h-56 overflow-hidden rounded-lg border border-(--border)">
                            <ImagePreview
                              sourceId={sourceNote.imageSource.id}
                              origin={sourceNote.imageSource.origin}
                              url={sourceNote.imageSource.url}
                              alt={getNoteSourceTitle(sourceNote)}
                              className="max-h-56 w-full object-contain"
                            />
                          </div>
                        )}

                        {sourceNote.sourceType === "AUDIO" &&
                          sourceNote.audioSource && (
                          <AudioPlayer
                            url={getAudioPlaybackUrl(
                              sourceNote.audioSource.id,
                              sourceNote.audioSource.origin,
                              sourceNote.audioSource.url,
                            )}
                            title={getNoteSourceTitle(sourceNote)}
                            className="mt-3"
                          />
                        )}

                        <p className="mt-2 text-xs tabular-nums text-(--text-secondary)">
                          {sourceNote.timestampSeconds !==
                          null
                            ? formatTime(
                                sourceNote.timestampSeconds,
                              )
                            : "No timestamp"}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {sourceNote &&
                      validSourceNoteId !==
                        null && (
                      <button
                        type="button"
                        onClick={() =>
                          navigate(
                            `/notes/${validSourceNoteId}`,
                          )
                        }
                        className="rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                      >
                        Open note
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        void handleViewSource()
                      }
                      disabled={isMutating}
                      className="flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ExternalLink
                        size={14}
                        aria-hidden="true"
                      />
                      Go to source
                    </button>
                  </div>
                </>
              ) : task.sourceStatus ===
                "SOURCE_MISSING" ? (
                <>
                  <h2 className="mt-2 text-sm font-semibold text-(--danger-text)">
                    {formatTaskSourceLabel(task)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-(--danger-text)">
                    This Task was preserved after its original Note was deleted.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-2 text-sm font-semibold text-(--text-primary)">
                    {formatTaskSourceLabel(task)}
                  </h2>
                  <p className="mt-2 text-sm text-(--text-muted)">
                    Created without a source note.
                  </p>
                </>
              )}
            </section>

            <dl className="mt-4 flex flex-col gap-2 border-t border-(--border) pt-4 text-xs text-(--text-muted) sm:flex-row sm:flex-wrap sm:gap-x-6">
              <div className="flex gap-2">
                <dt>Created</dt>
                <dd>
                  {formatDateTime(
                    task.createdAt,
                  )}
                </dd>
              </div>
              <div className="flex gap-2">
                <dt>Updated</dt>
                <dd>
                  {formatDateTime(
                    task.updatedAt,
                  )}
                </dd>
              </div>
            </dl>
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
            ? sourceNote?.sourceType ===
              "YOUTUBE"
              ? "Deleting this Task does not delete its source Note or YouTube source."
              : "Deleting this Task does not delete its source Note or exact source record."
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
