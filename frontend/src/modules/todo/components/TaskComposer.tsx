import { ChevronDown, Plus } from "lucide-react";

import type { Note } from "../../notes/services/noteApi";

interface TaskComposerProps {
  notes: Note[];

  title: string;
  description: string;
  deadline: string;
  sourceNoteId: string;

  isMutating: boolean;
  errorMessage?: string | null;
  allowSourceSelection?: boolean;

  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onDeadlineChange: (value: string) => void;
  onSourceNoteIdChange: (value: string) => void;
  onCreate: () => Promise<void>;
}

export function TaskComposer({
  notes,
  title,
  description,
  deadline,
  sourceNoteId,
  isMutating,
  errorMessage,
  allowSourceSelection = true,
  onTitleChange,
  onDescriptionChange,
  onDeadlineChange,
  onSourceNoteIdChange,
  onCreate,
}: TaskComposerProps) {
  return (
    <section
      aria-busy={isMutating}
      className="rounded-xl border border-(--border) bg-(--app-bg) p-3"
    >
      <div className="flex items-center gap-2">
        <Plus
          size={14}
          className="shrink-0 text-(--text-muted)"
          aria-hidden="true"
        />

        <h4 className="text-xs font-medium text-(--text-secondary)">
          Create task
        </h4>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <label
          htmlFor="task-title"
          className="sr-only"
        >
          Task title
        </label>

        <input
          id="task-title"
          value={title}
          maxLength={255}
          disabled={isMutating}
          aria-required="true"
          aria-invalid={Boolean(errorMessage)}
          aria-describedby={
            errorMessage
              ? "task-create-error"
              : undefined
          }
          onChange={(event) =>
            onTitleChange(
              event.target.value,
            )
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();

              if (
                title.trim() &&
                !isMutating
              ) {
                void onCreate();
              }
            }
          }}
          placeholder="Task title..."
          className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm outline-none placeholder:text-(--text-faint) transition focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        />

        <button
          type="button"
          disabled={
            isMutating ||
            !title.trim()
          }
          onClick={() =>
            void onCreate()
          }
          className="h-10 shrink-0 rounded-lg bg-(--primary-bg) px-3 text-xs font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 xl:h-8"
        >
          {isMutating
            ? "Saving..."
            : sourceNoteId
              ? "Create"
              : "Add"}
        </button>
      </div>

      <details className="mt-2 group">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1.5 px-1 py-1 text-xs text-(--text-muted) outline-none focus-visible:ring-2 focus-visible:ring-(--focus) xl:min-h-8">
          <ChevronDown
            size={13}
            className="transition-transform group-open:rotate-180"
            aria-hidden="true"
          />

          <span>More options</span>

          {allowSourceSelection && sourceNoteId && (
            <span className="text-(--text-muted)">
              · linked
            </span>
          )}

          {deadline && (
            <span className="text-(--text-muted)">
              · deadline
            </span>
          )}
        </summary>

        <div className="mt-2 space-y-2">
          <label
            htmlFor="task-description"
            className="sr-only"
          >
            Task description
          </label>

          <textarea
            id="task-description"
            value={description}
            disabled={isMutating}
            onChange={(event) =>
              onDescriptionChange(
                event.target.value,
              )
            }
            placeholder="Description (optional)"
            className="h-16 w-full resize-none rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-xs outline-none placeholder:text-(--text-faint) transition focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div
            className={`grid grid-cols-1 gap-2 ${
              allowSourceSelection
                ? "sm:grid-cols-2"
                : ""
            }`}
          >
            <div>
              <label
                htmlFor="task-deadline"
                className="sr-only"
              >
                Task deadline
              </label>

              <input
                id="task-deadline"
                type="date"
                value={deadline}
                disabled={isMutating}
                onChange={(event) =>
                  onDeadlineChange(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-xs text-(--text-secondary) outline-none transition focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            {allowSourceSelection && (
              <div>
                <label
                  htmlFor="task-source-note"
                  className="sr-only"
                >
                  Task source Note
                </label>

                <select
                  id="task-source-note"
                  value={sourceNoteId}
                  disabled={isMutating}
                  onChange={(event) =>
                    onSourceNoteIdChange(
                      event.target.value,
                    )
                  }
                  className="w-full rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-xs text-(--text-secondary) outline-none transition focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">
                    Independent task
                  </option>

                  {notes.map((note) => {
                    const sourceTitle =
                      note.youtubeSource
                        .title ??
                      note.youtubeSource
                        .youtubeVideoId;

                    const preview =
                      note.content
                        .replace(
                          /\s+/g,
                          " ",
                        )
                        .slice(
                          0,
                          40,
                        );

                    return (
                      <option
                        key={note.id}
                        value={note.id}
                      >
                        {sourceTitle}
                        {" — "}
                        {preview}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}
          </div>
        </div>
      </details>

      {errorMessage && (
        <p
          id="task-create-error"
          role="alert"
          className="mt-2 text-xs text-(--danger-text)"
        >
          {errorMessage}
        </p>
      )}
    </section>
  );
}
