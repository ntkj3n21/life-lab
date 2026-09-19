import {
  Pause,
  Play,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward,
} from "lucide-react";
import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface AudioPlayerProps {
  url: string;
  title: string;
  playerRef?: RefObject<HTMLAudioElement | null>;
  seekToSeconds?: number | null;
  seekRequestKey?: string;
  onReliablePosition?: (seconds: number) => void;

  onPrevious?: () => void;
  onNext?: () => void;
  canPrevious?: boolean;
  canNext?: boolean;

  shuffleEnabled?: boolean;
  onToggleShuffle?: () => void;

  className?: string;
}

function formatPlayerTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "00:00";
  }

  const wholeSeconds = Math.floor(seconds);
  const minutes = Math.floor(wholeSeconds / 60);
  const remainingSeconds = wholeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(
    remainingSeconds,
  ).padStart(2, "0")}`;
}

export function AudioPlayer({
  url,
  title,
  playerRef,
  seekToSeconds = null,
  seekRequestKey = "default",
  onReliablePosition,

  onPrevious,
  onNext,
  canPrevious = false,
  canNext = false,

  shuffleEnabled = false,
  onToggleShuffle,

  className,
}: AudioPlayerProps) {
  const internalRef = useRef<HTMLAudioElement | null>(null);

  const appliedSeekKeyRef = useRef<string | null>(null);

  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);

  const [currentTime, setCurrentTime] = useState(0);

  const [duration, setDuration] = useState(0);

  const [repeatEnabled, setRepeatEnabled] = useState(false);

  const resolvedRef = playerRef ?? internalRef;

  const seekKey = `${url}:${seekToSeconds ?? "none"}:${seekRequestKey}`;

  const hasPlaybackError = failedUrl === url;

  const hasDuration = Number.isFinite(duration) && duration > 0;

  function updateCurrentTime(player: HTMLAudioElement) {
    if (!Number.isFinite(player.currentTime) || player.currentTime < 0) {
      return;
    }

    setCurrentTime(player.currentTime);
  }

  function updateDuration(player: HTMLAudioElement) {
    const nextDuration = player.duration;

    setDuration(
      Number.isFinite(nextDuration) && nextDuration >= 0 ? nextDuration : 0,
    );
  }

  function reportPosition(player: HTMLAudioElement) {
    if (!Number.isFinite(player.currentTime) || player.currentTime < 0) {
      return;
    }

    onReliablePosition?.(Math.floor(player.currentTime));
  }

  const applyHistoricalSeek = useCallback(
    (player: HTMLAudioElement) => {
      if (
        appliedSeekKeyRef.current === seekKey ||
        typeof seekToSeconds !== "number" ||
        player.readyState < HTMLMediaElement.HAVE_METADATA
      ) {
        return;
      }

      try {
        player.currentTime = seekToSeconds;

        appliedSeekKeyRef.current = seekKey;
      } catch {
        /*
         * A later media readiness event
         * will retry the exact seek.
         */
      }
    },
    [seekKey, seekToSeconds],
  );

  useEffect(() => {
    const player = resolvedRef.current;

    if (player) {
      applyHistoricalSeek(player);
    }
  }, [applyHistoricalSeek, resolvedRef]);

  useEffect(() => {
    const player = resolvedRef.current;

    if (player) {
      player.loop = repeatEnabled;
    }
  }, [repeatEnabled, resolvedRef]);

  function handleReady(player: HTMLAudioElement) {
    setFailedUrl(null);

    updateDuration(player);
    applyHistoricalSeek(player);
    updateCurrentTime(player);
    reportPosition(player);
  }

  async function handleTogglePlayback() {
    const player = resolvedRef.current;

    if (!player) {
      return;
    }

    if (player.paused) {
      try {
        await player.play();
      } catch {
        /*
         * Browser playback policy or a
         * media error can reject play().
         * Native media events remain the
         * source of truth for player state.
         */
      }

      return;
    }

    player.pause();
  }

  function handleSeek(value: number) {
    const player = resolvedRef.current;

    if (!player || !Number.isFinite(value) || value < 0) {
      return;
    }

    try {
      player.currentTime = value;
      setCurrentTime(value);
    } catch {
      // Keep the existing reliable position.
    }
  }

  function handleToggleRepeat() {
    setRepeatEnabled((enabled) => !enabled);
  }

  return (
    <div className={className}>
      <audio
        ref={resolvedRef}
        src={url}
        preload="metadata"
        aria-label={`Audio player: ${title}`}
        onLoadedMetadata={(event) => handleReady(event.currentTarget)}
        onCanPlay={(event) => handleReady(event.currentTarget)}
        onDurationChange={(event) => {
          updateDuration(event.currentTarget);

          applyHistoricalSeek(event.currentTarget);
        }}
        onSeeked={(event) => {
          updateCurrentTime(event.currentTarget);

          reportPosition(event.currentTarget);
        }}
        onTimeUpdate={(event) => {
          updateCurrentTime(event.currentTarget);

          reportPosition(event.currentTarget);
        }}
        onPlay={(event) => {
          setIsPlaying(true);

          reportPosition(event.currentTarget);
        }}
        onPause={(event) => {
          setIsPlaying(false);

          updateCurrentTime(event.currentTarget);

          reportPosition(event.currentTarget);
        }}
        onEnded={(event) => {
          setIsPlaying(false);

          updateCurrentTime(event.currentTarget);

          reportPosition(event.currentTarget);
        }}
        onError={() => {
          setIsPlaying(false);
          setFailedUrl(url);
        }}
      >
        Your browser does not support audio playback.
      </audio>

      <div className="rounded-2xl bg-(--app-bg) px-3 py-4 sm:px-5">
        {/* Seek row */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <button
            type="button"
            onClick={onToggleShuffle}
            disabled={!onToggleShuffle}
            aria-pressed={shuffleEnabled}
            aria-label={shuffleEnabled ? "Disable shuffle" : "Enable shuffle"}
            title={shuffleEnabled ? "Shuffle on" : "Shuffle"}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-35 ${
              shuffleEnabled
                ? "bg-(--surface-hover) text-(--text-primary)"
                : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary)"
            }`}
          >
            <Shuffle size={16} aria-hidden="true" />
          </button>

          <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
            <span className="w-11 text-right text-xs tabular-nums text-(--text-secondary)">
              {formatPlayerTime(currentTime)}
            </span>

            <input
              type="range"
              min={0}
              max={hasDuration ? duration : 0}
              step={0.1}
              value={hasDuration ? Math.min(currentTime, duration) : 0}
              disabled={!hasDuration || hasPlaybackError}
              onChange={(event) => handleSeek(Number(event.target.value))}
              aria-label={`Seek ${title}`}
              aria-valuetext={`${formatPlayerTime(
                currentTime,
              )} of ${formatPlayerTime(duration)}`}
              className="h-1.5 min-w-0 w-full cursor-pointer accent-current disabled:cursor-not-allowed disabled:opacity-40"
            />

            <span className="w-11 text-xs tabular-nums text-(--text-secondary)">
              {formatPlayerTime(duration)}
            </span>
          </div>

          {/* Keeps seek row balanced.
              Repeat lives on the row below. */}
          <div className="h-9 w-9" aria-hidden="true" />
        </div>

        {/* Playback row */}
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center">
          <div />

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onPrevious}
              disabled={!onPrevious || !canPrevious}
              aria-label="Previous audio"
              title="Previous"
              className="flex h-10 w-10 items-center justify-center rounded-full text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-35"
            >
              <SkipBack size={20} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => void handleTogglePlayback()}
              disabled={hasPlaybackError || !url}
              aria-label={isPlaying ? "Pause audio" : "Play audio"}
              title={isPlaying ? "Pause" : "Play"}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-(--primary-bg) text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPlaying ? (
                <Pause size={24} fill="currentColor" aria-hidden="true" />
              ) : (
                <Play size={24} fill="currentColor" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              disabled={!onNext || !canNext}
              aria-label="Next audio"
              title="Next"
              className="flex h-10 w-10 items-center justify-center rounded-full text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-35"
            >
              <SkipForward size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleToggleRepeat}
              aria-pressed={repeatEnabled}
              aria-label={
                repeatEnabled ? "Disable repeat" : "Repeat current audio"
              }
              title={repeatEnabled ? "Repeat on" : "Repeat"}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${
                repeatEnabled
                  ? "bg-(--surface-hover) text-(--text-primary)"
                  : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary)"
              }`}
            >
              <Repeat2 size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {hasPlaybackError && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)"
        >
          This exact audio source could not be played. The source has not been
          changed.
        </p>
      )}
    </div>
  );
}
