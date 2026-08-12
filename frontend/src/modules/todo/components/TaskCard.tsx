import {
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";

import { useState } from "react";

import {
  useReverseContextNavigation,
} from "../../context/hooks/useReverseContextNavigation";

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
}

function formatSource(
  task: Task,
) {
  switch (
    task.sourceStatus
  ) {
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
}: TaskCardProps) {
  const [
    isEditing,
    setIsEditing,
  ] = useState(false);

  const [
    title,
    setTitle,
  ] = useState(
    task.title,
  );

    const {
        openTaskContext,
        } =
        useReverseContextNavigation();
  
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

    setIsEditing(
      true,
    );
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

    setIsEditing(
      false,
    );
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

    await onUpdate(
      task.id,
      {
        title:
          trimmedTitle,

        description:
          description.trim() ||
          null,

        deadline:
          deadline || null,
      },
    );

    setIsEditing(
      false,
    );
  }

  async function handleDelete() {
    const confirmed =
      window.confirm(
        `Delete task "${task.title}"?`,
      );

    if (!confirmed) {
      return;
    }

    await onDelete(
      task.id,
    );
  }

  return (
    <article className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
      {isEditing ? (
        <div className="space-y-2">
          <input
            value={title}
            maxLength={255}
            disabled={
              isMutating
            }
            onChange={(
              event,
            ) =>
              setTitle(
                event.target
                  .value,
              )
            }
            placeholder="Task title"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-neutral-600"
          />

          <textarea
            value={
              description
            }
            disabled={
              isMutating
            }
            onChange={(
              event,
            ) =>
              setDescription(
                event.target
                  .value,
              )
            }
            placeholder="Description"
            className="h-20 w-full resize-none rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs outline-none focus:border-neutral-600"
          />

          <input
            type="date"
            value={
              deadline
            }
            disabled={
              isMutating
            }
            onChange={(
              event,
            ) =>
              setDeadline(
                event.target
                  .value,
              )
            }
            className="w-full rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs outline-none focus:border-neutral-600"
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={
                isMutating
              }
              onClick={
                handleCancelEditing
              }
              className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 transition hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
              className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-medium text-neutral-200">
                {task.title}
              </p>

              {task.description && (
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-neutral-500">
                  {
                    task.description
                  }
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={
                isMutating
              }
              onClick={
                handleStartEditing
              }
              className="shrink-0 rounded-lg border border-neutral-800 p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              title="Edit task"
            >
              <Pencil
                size={13}
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
              {formatSource(
                task,
              )}
            </span>

            <span className="rounded-full bg-neutral-800 px-2 py-1 text-neutral-400">
              {task.deadline
                ? `Due ${task.deadline}`
                : "No deadline"}
            </span>
          </div>

            <button
            type="button"
            disabled={
                isMutating
            }
            onClick={() =>
                void openTaskContext(
                task.id,
                )
            }
            className="flex shrink-0 items-center gap-1 rounded-lg border border-neutral-800 px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:opacity-40"
            title="View original source"
            >
            <ExternalLink
                size={12}
            />

            Source
            </button>

            <div className="mt-3 flex items-center gap-2 border-t border-neutral-800 pt-3">
            <button
                type="button"
                disabled={
                isMutating
                }
                onClick={() =>
                void openTaskContext(
                    task.id,
                )
                }
                className="flex shrink-0 items-center gap-1 rounded-lg border border-neutral-800 px-2 py-1.5 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:opacity-40"
                title="View original source"
            >
                <ExternalLink
                size={12}
                />

                Source
            </button>

            <select
                value={
                task.status
                }
                disabled={
                isMutating
                }
                onChange={(
                event,
                ) =>
                void onStatusChange(
                    task.id,
                    event.target
                    .value as TaskStatus,
                )
                }
                className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-300 outline-none focus:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-40"
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
                disabled={
                isMutating
                }
                onClick={() =>
                void handleDelete()
                }
                className="rounded-lg border border-neutral-800 p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                title="Delete task"
            >
                <Trash2
                size={13}
                />
            </button>
            </div>
        </>
      )}
    </article>
  );
}