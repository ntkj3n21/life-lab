import { formatTime } from "../../../utils/formatTime";

interface QuickNoteComposerProps {
  hasActiveVideo: boolean;
  timestamp?: number;

  content: string;
  includeTimestamp: boolean;

  isMutating: boolean;
  errorMessage?: string | null;

  onContentChange: (value: string) => void;
  onIncludeTimestampChange: (value: boolean) => void;
  onCreate: () => Promise<void>;
}

export function QuickNoteComposer({
  hasActiveVideo,
  timestamp,
  content,
  includeTimestamp,
  isMutating,
  errorMessage,
  onContentChange,
  onIncludeTimestampChange,
  onCreate,
}: QuickNoteComposerProps) {
  const noteInputDescriptionId =
    !hasActiveVideo
      ? "quick-note-video-required"
      : errorMessage
        ? "quick-note-error"
        : undefined;

  return (
    <div
      aria-busy={isMutating}
      className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium text-neutral-300">
            Quick Note
          </h4>

          <p className="mt-1 text-xs text-neutral-500">
            Save a note to the exact current video
            source.
          </p>
        </div>

        {typeof timestamp === "number" && (
          <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-500">
            {formatTime(timestamp)}
          </span>
        )}
      </div>

      {!hasActiveVideo && (
        <p
          id="quick-note-video-required"
          role="status"
          className="mt-3 rounded-xl border border-dashed border-neutral-800 p-3 text-xs text-neutral-500"
        >
          Open a Library video before creating a note.
        </p>
      )}

      <label
        htmlFor="quick-note-content"
        className="sr-only"
      >
        Note content
      </label>

      <textarea
        id="quick-note-content"
        value={content}
        disabled={!hasActiveVideo || isMutating}
        aria-describedby={noteInputDescriptionId}
        aria-invalid={Boolean(errorMessage)}
        onChange={(event) =>
          onContentChange(
            event.target.value,
          )
        }
        placeholder="Write your note..."
        className="mt-3 h-32 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
      />

      <label className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
        <input
          type="checkbox"
          checked={includeTimestamp}
          disabled={!hasActiveVideo || isMutating}
          onChange={(event) =>
            onIncludeTimestampChange(
              event.target.checked,
            )
          }
        />

        Include current timestamp
      </label>

      <button
        type="button"
        onClick={() =>
          void onCreate()
        }
        disabled={
          !hasActiveVideo ||
          isMutating ||
          !content.trim()
        }
        className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isMutating
          ? "Saving..."
          : "Save Note"}
      </button>

      {errorMessage && (
        <p
          id="quick-note-error"
          role="alert"
          className="mt-2 text-xs text-red-400"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}