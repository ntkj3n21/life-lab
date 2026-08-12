import { Plus } from "lucide-react";

import type { Note } from "../../notes/services/noteApi";

interface TaskComposerProps {
  notes: Note[];

  title: string;
  description: string;
  deadline: string;
  sourceNoteId: string;

  isMutating: boolean;
  errorMessage?: string | null;

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
  onTitleChange,
  onDescriptionChange,
  onDeadlineChange,
  onSourceNoteIdChange,
  onCreate,
}: TaskComposerProps) {
  return (
    <section
      aria-busy={isMutating}
      className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
    >
      <div className="flex items-center gap-2">
        <Plus
          size={16}
          className="text-neutral-500"
          aria-hidden="true"
        />

        <div>
          <h4 className="text-sm font-medium text-neutral-300">
            Create Task
          </h4>

          <p className="mt-1 text-xs text-neutral-500">
            Create an independent task or link it to an
            existing Note.
          </p>
        </div>
      </div>

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
        aria-invalid={Boolean(errorMessage)}
        aria-describedby={
          errorMessage
            ? "task-create-error"
            : undefined
        }
        onChange={(event) =>
          onTitleChange(event.target.value)
        }
        placeholder="Task title"
        className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      />

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
        className="mt-2 h-20 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs outline-none placeholder:text-neutral-600 focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      />

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
        className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      />

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
        className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">
          Independent task
        </option>

        {notes.map((note) => {
          const sourceTitle =
            note.youtubeSource.title ??
            note.youtubeSource.youtubeVideoId;

          const preview = note.content
            .replace(/\s+/g, " ")
            .slice(0, 40);

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

      <button
        type="button"
        disabled={
          isMutating ||
          !title.trim()
        }
        onClick={() =>
          void onCreate()
        }
        className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isMutating
          ? "Saving..."
          : sourceNoteId
            ? "Create from Note"
            : "Create Task"}
      </button>

      {errorMessage && (
        <p
          id="task-create-error"
          role="alert"
          className="mt-2 text-xs text-red-400"
        >
          {errorMessage}
        </p>
      )}
    </section>
  );
}