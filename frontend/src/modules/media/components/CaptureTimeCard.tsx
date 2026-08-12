import { Clock } from "lucide-react";

import { formatTime } from "../../../utils/formatTime";

interface WatchSessionSummary {
  watchTimeSeconds: number;
  validityStatus: string;
}

interface CaptureTimeCardProps {
  timestamp?: number;

  canPlayVideo: boolean;
  hasActiveVideo: boolean;

  watchSession: WatchSessionSummary | null;
  watchErrorMessage?: string | null;

  onDecrease: () => void;
  onReset: () => void;
  onIncrease: () => void;
}

export function CaptureTimeCard({
  timestamp,
  canPlayVideo,
  hasActiveVideo,
  watchSession,
  watchErrorMessage,
  onDecrease,
  onReset,
  onIncrease,
}: CaptureTimeCardProps) {
  const playbackStatus =
    canPlayVideo
      ? "Live"
      : hasActiveVideo
        ? "Unavailable"
        : "No video";

  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Clock
              size={16}
              className="text-neutral-400"
              aria-hidden="true"
            />

            <h4 className="font-medium">
              Capture time
            </h4>
          </div>

          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Auto-updates while the video plays. Notes
            and tasks will use this timestamp when
            saved.
          </p>
        </div>

        <span
          aria-label={`Playback status: ${playbackStatus}`}
          className={`shrink-0 rounded-full px-2 py-1 text-xs ${
            canPlayVideo
              ? "bg-neutral-800 text-neutral-300"
              : hasActiveVideo
                ? "bg-red-950/60 text-red-400"
                : "bg-neutral-950 text-neutral-600"
          }`}
        >
          {playbackStatus}
        </span>
      </div>

      <p
        aria-label={`Current capture time ${formatTime(
          timestamp,
        )}`}
        className="mt-4 text-3xl font-semibold tabular-nums"
      >
        {formatTime(timestamp)}
      </p>

      <div className="mt-3 rounded-xl bg-neutral-950 px-3 py-2">
        <p className="text-xs text-neutral-500">
          Watch session
        </p>

        {watchSession ? (
          <p className="mt-1 wrap-break-word text-xs text-neutral-300">
            {watchSession.watchTimeSeconds}s
            {" · "}
            {watchSession.validityStatus}
          </p>
        ) : (
          <p className="mt-1 text-xs text-neutral-600">
            Starts when the video actually plays.
          </p>
        )}

        {watchErrorMessage && (
          <p
            role="alert"
            className="mt-2 wrap-break-word text-xs text-red-400"
          >
            {watchErrorMessage}
          </p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onDecrease}
          disabled={!canPlayVideo}
          className="rounded-xl border border-neutral-800 px-2 py-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          -5s
        </button>

        <button
          type="button"
          onClick={onReset}
          disabled={!canPlayVideo}
          className="rounded-xl border border-neutral-800 px-2 py-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>

        <button
          type="button"
          onClick={onIncrease}
          disabled={!canPlayVideo}
          className="rounded-xl border border-neutral-800 px-2 py-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          +5s
        </button>
      </div>
    </section>
  );
}