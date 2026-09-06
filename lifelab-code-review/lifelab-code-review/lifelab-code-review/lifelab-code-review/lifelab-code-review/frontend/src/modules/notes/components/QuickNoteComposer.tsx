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
      className="rounded-xl border border-(--border) bg-(--app-bg) p-3"
    >
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-medium text-(--text-secondary)">
          Quick Note
        </h4>

        {typeof timestamp === "number" && (
          <span className="tabular-nums text-xs text-(--text-muted)">
            {formatTime(timestamp)}
          </span>
        )}
      </div>

      {!hasActiveVideo && (
        <p
          id="quick-note-video-required"
          role="status"
          className="mt-2 rounded-lg border border-dashed border-(--border) px-3 py-2 text-xs text-(--text-muted)"
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
        aria-required="true"
        aria-describedby={noteInputDescriptionId}
        aria-invalid={Boolean(errorMessage)}
        onChange={(event) =>
          onContentChange(event.target.value)
        }
        placeholder="Write your note..."
        className="mt-2 h-20 w-full resize-none rounded-lg border border-(--border) bg-(--surface) p-3 text-sm outline-none placeholder:text-(--text-faint) transition focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <label className="flex min-h-10 min-w-0 items-center gap-2 text-xs text-(--text-muted)">
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

          <span className="truncate">
            Include timestamp
          </span>
        </label>

        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={
            !hasActiveVideo ||
            isMutating ||
            !content.trim()
          }
          className="h-10 shrink-0 rounded-lg bg-(--primary-bg) px-3 text-xs font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 xl:h-8"
        >
          {isMutating
            ? "Saving..."
            : "Save"}
        </button>
      </div>

      {errorMessage && (
        <p
          id="quick-note-error"
          role="alert"
          className="mt-2 text-xs text-(--danger-text)"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
