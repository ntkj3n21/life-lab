import { Clock } from "lucide-react";

import { formatTime } from "../../../utils/formatTime";

interface CaptureTimeCardProps {
  timestamp?: number;
  canPlayVideo: boolean;
  hasActiveVideo: boolean;
  watchErrorMessage?: string | null;
  onDecrease: () => void;
  onReset: () => void;
  onIncrease: () => void;
}

export function CaptureTimeCard({
  timestamp,
  canPlayVideo,
  hasActiveVideo,
  watchErrorMessage,
  onDecrease,
  onReset,
  onIncrease,
}: CaptureTimeCardProps) {
  const playbackStatus = canPlayVideo
    ? "Live"
    : hasActiveVideo
      ? "Unavailable"
      : "No video";

  return (
    <section className="rounded-xl border border-(--border) bg-(--surface) p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Clock
            size={16}
            className="text-(--text-secondary)"
            aria-hidden="true"
          />
          <h4 className="font-medium">Capture time</h4>
        </div>

        {!canPlayVideo && (
          <span
            aria-label={`Playback status: ${playbackStatus}`}
            className={`shrink-0 rounded-full px-2 py-1 text-xs ${
              hasActiveVideo
                ? "bg-(--danger-surface) text-(--danger-text)"
                : "bg-(--app-bg) text-(--text-faint)"
            }`}
          >
            {playbackStatus}
          </span>
        )}
      </div>

      <p
        aria-label={`Current capture time ${formatTime(timestamp)}`}
        className="mt-3 text-3xl font-semibold tabular-nums"
      >
        {formatTime(timestamp)}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onDecrease}
          disabled={!canPlayVideo}
          className="rounded-lg px-2 py-2 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
        >
          -5s
        </button>
        <button
          type="button"
          onClick={onReset}
          disabled={!canPlayVideo}
          className="rounded-lg px-2 py-2 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onIncrease}
          disabled={!canPlayVideo}
          className="rounded-lg px-2 py-2 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
        >
          +5s
        </button>
      </div>

      {watchErrorMessage && (
        <p
          role="alert"
          className="mt-3 wrap-break-word text-xs text-(--danger-text)"
        >
          {watchErrorMessage}
        </p>
      )}
    </section>
  );
}
