import {
  Ellipsis,
  Eye,
  ExternalLink,
  ListTodo,
  Pencil,
  StickyNote,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { formatTime } from "../../../utils/formatTime";
import type { Note } from "../services/noteApi";

type NoteCaseTransform =
  | "uppercase"
  | "lowercase"
  | "sentence";

function transformNoteDraft(
  value: string,
  transform: NoteCaseTransform,
) {
  if (transform === "uppercase") {
    return value.toUpperCase();
  }

  if (transform === "lowercase") {
    return value.toLowerCase();
  }

  return value
    .toLowerCase()
    .replace(
      /((?:^|[.!?]\s+|\n+)[ \t]*)(\p{L})/gmu,
      (_, prefix: string, letter: string) =>
        `${prefix}${letter.toUpperCase()}`,
    );
}

interface NoteCardProps {
  note: Note;
  current: boolean;
  variant?:
    | "default"
    | "workspace-current"
    | "workspace-recent";

  isMutating: boolean;
  isEditing: boolean;
  editingContent: string;

  onEditingContentChange: (value: string) => void;
  onStartEdit: (note: Note) => void;
  onCancelEdit: () => void;
  onSaveEdit: (noteId: number) => Promise<void>;
  onDelete: (note: Note) => Promise<void>;
  onViewSource: (noteId: number) => Promise<void>;
  onCreateTask?: (note: Note) => void;

  onOpenDetail?: (noteId: number) => void;
}

export function NoteCard({
  note,
  current,
  variant = "default",
  isMutating,
  isEditing,
  editingContent,
  onEditingContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onViewSource,
  onCreateTask,
  onOpenDetail,
}: NoteCardProps) {
  const contentId =
    `note-content-${note.id}`;

  const isWorkspace =
    variant !== "default";

  const showSource =
    variant !==
    "workspace-current";

  const [
    workspaceActionsOpen,
    setWorkspaceActionsOpen,
  ] = useState(false);

  const workspaceActionsRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const workspaceActionsTriggerRef =
    useRef<HTMLButtonElement | null>(
      null,
    );

  const workspaceActionsId =
    `note-actions-${note.id}`;

  useEffect(() => {
    if (!workspaceActionsOpen) {
      return;
    }

    function handlePointerDown(
      event: PointerEvent,
    ) {
      if (
        event.target instanceof Node &&
        !workspaceActionsRef.current?.contains(
          event.target,
        )
      ) {
        setWorkspaceActionsOpen(false);
      }
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key !== "Escape") {
        return;
      }

      setWorkspaceActionsOpen(false);
      workspaceActionsTriggerRef.current?.focus();
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
  }, [workspaceActionsOpen]);

  return (
    <article
      aria-busy={isMutating}
      className={`rounded-xl border transition-colors duration-150 ${
        isWorkspace
          ? "p-2.5"
          : "p-3"
      } ${
        current
          ? "border-(--border-strong) bg-(--surface)"
          : "border-(--border) bg-(--surface) hover:border-(--border-strong) hover:bg-(--surface-hover)"
      }`}
    >
      {isEditing ? (
        <>
          <label
            htmlFor={contentId}
            className="sr-only"
          >
            Note content
          </label>

          <textarea
            id={contentId}
            value={editingContent}
            disabled={isMutating}
            onChange={(event) =>
              onEditingContentChange(
                event.target.value,
              )
            }
            className="h-28 w-full resize-none rounded-xl border border-(--border) bg-(--app-bg) p-3 text-sm outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            <label
              htmlFor={`note-case-${note.id}`}
              className="sr-only"
            >
              Change Note text case
            </label>

            <select
              id={`note-case-${note.id}`}
              value=""
              disabled={isMutating}
              onChange={(event) => {
                const transform =
                  event.target
                    .value as NoteCaseTransform;

                if (!transform) {
                  return;
                }

                onEditingContentChange(
                  transformNoteDraft(
                    editingContent,
                    transform,
                  ),
                );
              }}
              className={`rounded-lg border border-(--border) bg-(--app-bg) px-2 py-1 text-xs font-medium text-(--text-secondary) outline-none transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 ${
                isWorkspace
                  ? "min-h-10 xl:min-h-8"
                  : ""
              }`}
              title="Change text case"
            >
              <option value="" disabled>
                Aa
              </option>
              <option value="uppercase">
                UPPERCASE
              </option>
              <option value="lowercase">
                lowercase
              </option>
              <option value="sentence">
                Sentence case
              </option>
            </select>

            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isMutating}
              className={`rounded-lg border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 ${
                isWorkspace
                  ? "min-h-10 xl:min-h-8"
                  : ""
              }`}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() =>
                void onSaveEdit(
                  note.id,
                )
              }
              disabled={
                isMutating ||
                !editingContent.trim()
              }
              className={`rounded-lg bg-(--primary-bg) px-3 py-1 text-xs font-medium text-(--primary-text) hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 ${
                isWorkspace
                  ? "min-h-10 xl:min-h-8"
                  : ""
              }`}
            >
              {isMutating
                ? "Saving..."
                : "Save"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-2">
            {!isWorkspace && (
              <StickyNote
                size={15}
                className="mt-0.5 shrink-0 text-(--text-muted)"
                aria-hidden="true"
              />
            )}

            <p
              className={`min-w-0 whitespace-pre-wrap wrap-break-word text-sm leading-6 ${
                isWorkspace
                  ? "font-medium text-(--text-primary)"
                  : "text-(--text-secondary)"
              }`}
            >
              {note.content}
            </p>
          </div>

          {isWorkspace ? (
            <div className="mt-2 min-w-0 text-xs text-(--text-muted)">
              {showSource && (
                <p
                  className="truncate"
                  title={
                    note.youtubeSource
                      .title ??
                    "YouTube video"
                  }
                >
                  {note.youtubeSource
                    .title ??
                    "YouTube video"}
                </p>
              )}

              <div
                className={`flex items-center justify-between gap-2 ${
                  showSource
                    ? "mt-1"
                    : ""
                }`}
              >
                <p>
                  {note.timestampSeconds !==
                  null
                    ? formatTime(
                        note.timestampSeconds,
                      )
                    : "No timestamp"}
                </p>

                <div
                  ref={workspaceActionsRef}
                  className="relative shrink-0"
                >
                  <button
                    ref={
                      workspaceActionsTriggerRef
                    }
                    type="button"
                    disabled={isMutating}
                    aria-label={`${
                      workspaceActionsOpen
                        ? "Hide"
                        : "Show"
                    } actions for Note ${note.id}`}
                    aria-expanded={
                      workspaceActionsOpen
                    }
                    aria-controls={
                      workspaceActionsId
                    }
                    onClick={() =>
                      setWorkspaceActionsOpen(
                        (open) => !open,
                      )
                    }
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                    title="Note actions"
                  >
                    <Ellipsis
                      size={17}
                      aria-hidden="true"
                    />
                  </button>

                  {workspaceActionsOpen && (
                    <div
                      id={workspaceActionsId}
                      aria-label={`Actions for Note ${note.id}`}
                      role="group"
                      className="absolute right-0 z-20 mt-1 flex gap-1.5 rounded-xl border border-(--border) bg-(--panel-bg) p-1.5 shadow-[var(--elevated-shadow)]"
                    >
                      {onOpenDetail && (
                        <button
                          type="button"
                          onClick={() => {
                            setWorkspaceActionsOpen(
                              false,
                            );
                            onOpenDetail(
                              note.id,
                            );
                          }}
                          disabled={isMutating}
                          aria-label={`Open Note ${note.id} details`}
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                          title="Note details"
                        >
                          <Eye
                            size={14}
                            aria-hidden="true"
                          />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setWorkspaceActionsOpen(
                            false,
                          );
                          void onViewSource(
                            note.id,
                          );
                        }}
                        disabled={isMutating}
                        aria-label={`View source for Note ${note.id}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                        title="View source"
                      >
                        <ExternalLink
                          size={14}
                          aria-hidden="true"
                        />
                      </button>

                      {onCreateTask && (
                        <button
                          type="button"
                          onClick={() => {
                            setWorkspaceActionsOpen(
                              false,
                            );
                            onCreateTask(note);
                          }}
                          disabled={isMutating}
                          aria-label={`Create Task from Note ${note.id}`}
                          className="flex h-10 w-10 items-center justify-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                          title="Create task"
                        >
                          <ListTodo
                            size={14}
                            aria-hidden="true"
                          />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setWorkspaceActionsOpen(
                            false,
                          );
                          onStartEdit(note);
                        }}
                        disabled={isMutating}
                        aria-label={`Edit Note ${note.id}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                        title="Edit note"
                      >
                        <Pencil
                          size={14}
                          aria-hidden="true"
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setWorkspaceActionsOpen(
                            false,
                          );
                          void onDelete(note);
                        }}
                        disabled={isMutating}
                        aria-label={`Delete Note ${note.id}`}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-(--text-muted) transition hover:bg-(--danger-surface) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                        title="Delete note"
                      >
                        <Trash2
                          size={14}
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-3 min-w-0 text-xs text-(--text-muted)">
                {showSource && (
                  <p
                    className="truncate"
                    title={
                      note.youtubeSource
                        .title ??
                      "YouTube video"
                    }
                  >
                    {note.youtubeSource
                      .title ??
                      "YouTube video"}
                  </p>
                )}

                <p
                  className={
                    showSource
                      ? "mt-1"
                      : undefined
                  }
                >
                  {note.timestampSeconds !==
                  null
                    ? formatTime(
                        note.timestampSeconds,
                      )
                    : "No timestamp"}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  {current && (
                    <span className="rounded-full bg-(--surface-hover) px-2 py-1 text-[10px] text-(--text-secondary)">
                      Current
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {onOpenDetail && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDetail(
                          note.id,
                        )
                      }
                      disabled={isMutating}
                      className="flex items-center gap-1.5 rounded-lg border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
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
                    onClick={() =>
                      void onViewSource(
                        note.id,
                      )
                    }
                    disabled={isMutating}
                    className="rounded-lg border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    View Source
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onStartEdit(note)
                    }
                    disabled={isMutating}
                    aria-label={`Edit Note ${note.id}`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                    title="Edit note"
                  >
                    <Pencil
                      size={13}
                      aria-hidden="true"
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void onDelete(note)
                    }
                    disabled={isMutating}
                    aria-label={`Delete Note ${note.id}`}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
                    title="Delete note"
                  >
                    <Trash2
                      size={13}
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
    </article>
  );
}
