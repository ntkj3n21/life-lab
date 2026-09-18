import { formatTime } from "../../../utils/formatTime";

interface QuickNoteComposerProps {
  hasActiveSource: boolean;
  sourceLabel?: string;
  sourceTitle?: string;
  supportsTimestamp: boolean;
  requiresAvailableTimestamp?: boolean;
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
  hasActiveSource,
  sourceLabel = "source",
  sourceTitle,
  supportsTimestamp,
  requiresAvailableTimestamp = false,
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
    !hasActiveSource
      ? "quick-note-source-required"
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

        {supportsTimestamp &&
          typeof timestamp === "number" && (
          <span className="tabular-nums text-xs text-(--text-muted)">
            {formatTime(timestamp)}
          </span>
        )}
      </div>

      {!hasActiveSource && (
        <p
          id="quick-note-source-required"
          role="status"
          className="mt-2 rounded-lg border border-dashed border-(--border) px-3 py-2 text-xs text-(--text-muted)"
        >
          Open a Library item before creating a note.
        </p>
      )}

      {hasActiveSource && sourceTitle && (
        <p className="mt-1 truncate text-xs text-(--text-muted)">
          {sourceTitle}
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
        disabled={!hasActiveSource || isMutating}
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
        {supportsTimestamp ? (
          <label className="flex min-h-10 min-w-0 items-center gap-2 text-xs text-(--text-muted)">
            <input
              type="checkbox"
              checked={includeTimestamp}
              disabled={!hasActiveSource || isMutating}
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
        ) : (
          <span className="text-xs capitalize text-(--text-muted)">
            {sourceLabel} note
          </span>
        )}

        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={
            !hasActiveSource ||
            isMutating ||
            !content.trim() ||
            (requiresAvailableTimestamp &&
              includeTimestamp &&
              typeof timestamp !== "number")
          }
          className="h-10 shrink-0 rounded-lg bg-(--primary-bg) px-3 text-xs font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 xl:h-8"
        >
          {isMutating
            ? "Saving..."
            : "Save"}
        </button>
      </div>

      {requiresAvailableTimestamp &&
        includeTimestamp &&
        typeof timestamp !== "number" && (
          <p className="mt-1 text-xs text-(--text-muted)">
            Wait for the audio position, or clear Include timestamp to save explicitly without one.
          </p>
        )}

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
