import {
  Eye,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useReverseContextNavigation } from "../../context/hooks/useReverseContextNavigation";
import type {
  Task,
  TaskStatus,
  UpdateTaskInput,
} from "../services/taskApi";

interface TaskCardProps {
  task: Task;

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
}

function formatSource(
  task: Task,
) {
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

export function TaskCard({
  task,
  isMutating,
  onUpdate,
  onStatusChange,
  onDelete,
  onOpenDetail,
}: TaskCardProps) {
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
      <article className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
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
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="h-20 w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={isMutating}
                onClick={
                  handleCancelEditing
                }
                className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-neutral-950 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
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
                <p className="wrap-break-word text-sm font-medium text-neutral-200">
                  {task.title}
                </p>

                {task.description && (
                  <p className="mt-1 whitespace-pre-wrap wrap-break-word text-xs leading-5 text-neutral-500">
                    {task.description}
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={isMutating}
                onClick={
                  handleStartEditing
                }
                aria-label={`Edit task ${task.title}`}
                className="shrink-0 rounded-lg border border-neutral-800 p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                title="Edit task"
              >
                <Pencil
                  size={13}
                  aria-hidden="true"
                />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px]">
              <span
                className={`rounded-full px-2 py-1 ${
                  task.sourceStatus ===
                  "SOURCE_MISSING"
                    ? "bg-red-950/60 text-red-400"
                    : task.sourceStatus ===
                        "HAS_SOURCE"
                      ? "bg-neutral-800 text-neutral-300"
                      : "bg-neutral-800 text-neutral-500"
                }`}
              >
                {formatSource(task)}
              </span>

              <span className="rounded-full bg-neutral-800 px-2 py-1 text-neutral-400">
                {task.deadline
                  ? `Due ${task.deadline}`
                  : "No deadline"}
              </span>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-3">
              {onOpenDetail && (
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() =>
                    onOpenDetail(
                      task.id,
                    )
                  }
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-neutral-800 px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Eye
                    size={12}
                    aria-hidden="true"
                  />
                  Details
                </button>
              )}

              <button
                type="button"
                disabled={isMutating}
                onClick={() =>
                  void handleViewSource()
                }
                className="flex shrink-0 items-center gap-1 rounded-lg border border-neutral-800 px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                title="View original source"
              >
                <ExternalLink
                  size={12}
                  aria-hidden="true"
                />

                Source
              </button>

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
                className="min-w-36 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="rounded-lg border border-neutral-800 p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                title="Delete task"
              >
                <Trash2
                  size={13}
                  aria-hidden="true"
                />
              </button>
            </div>
          </>
        )}
      </article>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={`Delete task "${task.title}"?`}
        description={
          task.sourceStatus === "HAS_SOURCE"
            ? "Deleting the Task does not delete its source Note or YouTube source."
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