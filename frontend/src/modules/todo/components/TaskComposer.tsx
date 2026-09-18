import {
  ChevronDown,
  LoaderCircle,
  Plus,
  X,
} from "lucide-react";
import { useId } from "react";

import { formatTime } from "../../../utils/formatTime";
import type { Note } from "../../notes/services/noteApi";

interface TaskComposerProps {
  title: string;
  description: string;
  deadline: string;
  linkedNote?: Note | null;
  showSourceControls?: boolean;
  canChooseNote?: boolean;
  notePickerOpen?: boolean;
  notes?: Note[];
  isLoadingNotes?: boolean;
  noteLoadErrorMessage?: string | null;
  sourceLabel?: string;
  isMutating: boolean;
  errorMessage?: string | null;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDeadlineChange: (value: string) => void;
  onChooseNote?: () => void;
  onCloseNotePicker?: () => void;
  onRetryNotes?: () => void;
  onSelectNote?: (note: Note) => void;
  onUnlinkNote?: () => void;
  onCreate: () => Promise<void>;
}

export function TaskComposer({
  title,
  description,
  deadline,
  linkedNote,
  showSourceControls = false,
  canChooseNote = false,
  notePickerOpen = false,
  notes = [],
  isLoadingNotes = false,
  noteLoadErrorMessage,
  sourceLabel = "video",
  isMutating,
  errorMessage,
  onTitleChange,
  onDescriptionChange,
  onDeadlineChange,
  onChooseNote,
  onCloseNotePicker,
  onRetryNotes,
  onSelectNote,
  onUnlinkNote,
  onCreate,
}: TaskComposerProps) {
  const notePickerId = useId();

  return (
    <section
      aria-busy={isMutating}
      className="rounded-xl border border-(--border) bg-(--app-bg) p-3"
    >
      <div className="flex items-center gap-2">
        <Plus size={14} className="shrink-0 text-(--text-muted)" aria-hidden="true" />
        <h4 className="text-xs font-medium text-(--text-secondary)">Create task</h4>
      </div>

      {showSourceControls && (
        <div className="mt-3 rounded-lg border border-(--border) bg-(--surface) p-3">
          {linkedNote ? (
            <>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-(--text-muted)">
                  Created from note
                </p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap wrap-break-word text-xs leading-5 text-(--text-primary)">
                  {linkedNote.content}
                </p>
                <p className="mt-1.5 text-[11px] tabular-nums text-(--text-muted)">
                  {linkedNote.timestampSeconds !== null
                    ? formatTime(linkedNote.timestampSeconds)
                    : "No timestamp"}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {canChooseNote && onChooseNote && (
                  <button
                    type="button"
                    onClick={onChooseNote}
                    disabled={isMutating}
                    aria-expanded={notePickerOpen}
                    aria-controls={notePickerId}
                    className="min-h-9 rounded-lg border border-(--border) px-2.5 text-xs font-medium text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Change
                  </button>
                )}

                {onUnlinkNote && (
                  <button
                    type="button"
                    onClick={onUnlinkNote}
                    disabled={isMutating}
                    className="min-h-9 rounded-lg px-2.5 text-xs text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Unlink
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex min-w-0 items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-(--text-secondary)">
                  Independent task
                </p>
                <p className="mt-0.5 text-[11px] text-(--text-muted)">
                  No source note attached.
                </p>
              </div>

              {canChooseNote && onChooseNote && (
                <button
                  type="button"
                  onClick={onChooseNote}
                  disabled={isMutating}
                  aria-expanded={notePickerOpen}
                  aria-controls={notePickerId}
                  className="min-h-9 shrink-0 rounded-lg border border-(--border) px-2.5 text-xs font-medium text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Choose note
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {showSourceControls && canChooseNote && notePickerOpen && (
        <div
          id={notePickerId}
          className="mt-2 min-w-0 rounded-lg border border-(--border) bg-(--panel-bg) p-2"
        >
          <div className="flex items-center justify-between gap-2 px-1">
            <p className="text-xs font-medium text-(--text-secondary)">
              Choose a note from this {sourceLabel}
            </p>
            {onCloseNotePicker && (
              <button
                type="button"
                onClick={onCloseNotePicker}
                disabled={isMutating}
                aria-label="Close note picker"
                title="Close"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {isLoadingNotes ? (
            <div
              role="status"
              className="flex min-h-20 items-center justify-center gap-2 text-xs text-(--text-muted)"
            >
              <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
              Loading notes...
            </div>
          ) : noteLoadErrorMessage ? (
            <div className="mt-2 rounded-lg border border-(--danger-border) bg-(--danger-surface) p-2.5">
              <p role="alert" className="text-xs text-(--danger-text)">
                {noteLoadErrorMessage}
              </p>
              {onRetryNotes && (
                <button
                  type="button"
                  onClick={onRetryNotes}
                  disabled={isMutating}
                  className="mt-2 min-h-9 rounded-lg border border-(--danger-border) px-2.5 text-xs font-medium text-(--danger-text) transition hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Retry
                </button>
              )}
            </div>
          ) : notes.length === 0 ? (
            <div className="px-2 py-4 text-center">
              <p className="text-xs font-medium text-(--text-secondary)">
                No notes for this {sourceLabel} yet.
              </p>
              <p className="mt-1 text-[11px] leading-5 text-(--text-muted)">
                Create a note first if you want the task to preserve {sourceLabel} context.
              </p>
            </div>
          ) : (
            <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto overscroll-contain pr-1">
              {notes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  disabled={isMutating}
                  onClick={() => onSelectNote?.(note)}
                  aria-label={`Choose note at ${
                    note.timestampSeconds !== null
                      ? formatTime(note.timestampSeconds)
                      : "no timestamp"
                  }`}
                  className="block w-full min-w-0 rounded-lg border border-(--border) bg-(--surface) p-2.5 text-left transition hover:border-(--border-strong) hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="line-clamp-3 whitespace-pre-wrap wrap-break-word text-xs leading-5 text-(--text-primary)">
                    {note.content}
                  </span>
                  <span className="mt-1 block text-[11px] tabular-nums text-(--text-muted)">
                    {note.timestampSeconds !== null
                      ? formatTime(note.timestampSeconds)
                      : "No timestamp"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <label htmlFor="task-title" className="sr-only">Task title</label>
        <input
          id="task-title"
          value={title}
          maxLength={255}
          disabled={isMutating}
          aria-required="true"
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={errorMessage ? "task-create-error" : undefined}
          onChange={(event) => onTitleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (title.trim() && !isMutating) void onCreate();
            }
          }}
          placeholder="Task title..."
          className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm outline-none placeholder:text-(--text-faint) transition focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        />
        <button
          type="button"
          disabled={isMutating || !title.trim()}
          onClick={() => void onCreate()}
          className="h-10 shrink-0 rounded-lg bg-(--primary-bg) px-3 text-xs font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 xl:h-8"
        >
          {isMutating ? "Saving..." : linkedNote ? "Create Task" : "Add"}
        </button>
      </div>

      <details className="mt-2 group">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 px-1 py-1 text-xs text-(--text-muted) outline-none focus-visible:ring-2 focus-visible:ring-(--focus) xl:min-h-8">
          <ChevronDown size={13} className="transition-transform group-open:rotate-180" aria-hidden="true" />
          <span>More options</span>
          {linkedNote && <span>· linked</span>}
          {deadline && <span>· deadline</span>}
        </summary>
        <div className="mt-2 space-y-2">
          <label htmlFor="task-description" className="sr-only">Task description</label>
          <textarea
            id="task-description"
            value={description}
            disabled={isMutating}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder="Description (optional)"
            className="h-16 w-full resize-none rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-xs outline-none placeholder:text-(--text-faint) transition focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
          />
          <label htmlFor="task-deadline" className="sr-only">Task deadline</label>
          <input
            id="task-deadline"
            type="date"
            value={deadline}
            disabled={isMutating}
            onChange={(event) => onDeadlineChange(event.target.value)}
            className="w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-xs text-(--text-secondary) outline-none transition focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </details>

      {errorMessage && (
        <p id="task-create-error" role="alert" className="mt-2 text-xs text-(--danger-text)">
          {errorMessage}
        </p>
      )}
    </section>
  );
}
