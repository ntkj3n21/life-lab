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
  className?: string;
}

export function AudioPlayer({
  url,
  title,
  playerRef,
  seekToSeconds = null,
  seekRequestKey = "default",
  onReliablePosition,
  className,
}: AudioPlayerProps) {
  const internalRef = useRef<HTMLAudioElement | null>(null);
  const appliedSeekKeyRef = useRef<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const resolvedRef = playerRef ?? internalRef;
  const seekKey = `${url}:${seekToSeconds ?? "none"}:${seekRequestKey}`;
  const hasPlaybackError = failedUrl === url;

  function reportPosition(player: HTMLAudioElement) {
    if (!Number.isFinite(player.currentTime) || player.currentTime < 0) {
      return;
    }

    onReliablePosition?.(Math.floor(player.currentTime));
  }

  const applyHistoricalSeek = useCallback((player: HTMLAudioElement) => {
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
      // A later media readiness event will retry the exact seek.
    }
  }, [seekKey, seekToSeconds]);

  useEffect(() => {
    const player = resolvedRef.current;
    if (player) {
      applyHistoricalSeek(player);
    }
  }, [applyHistoricalSeek, resolvedRef]);

  function handleReady(player: HTMLAudioElement) {
    setFailedUrl(null);
    applyHistoricalSeek(player);
    reportPosition(player);
  }

  return (
    <div className={className}>
      <audio
        ref={resolvedRef}
        src={url}
        controls
        preload="metadata"
        aria-label={`Audio player: ${title}`}
        onLoadedMetadata={(event) => handleReady(event.currentTarget)}
        onCanPlay={(event) => handleReady(event.currentTarget)}
        onDurationChange={(event) => applyHistoricalSeek(event.currentTarget)}
        onSeeked={(event) => reportPosition(event.currentTarget)}
        onTimeUpdate={(event) => reportPosition(event.currentTarget)}
        onPlay={(event) => reportPosition(event.currentTarget)}
        onPause={(event) => reportPosition(event.currentTarget)}
        onError={() => setFailedUrl(url)}
        className="w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
      >
        Your browser does not support audio playback.
      </audio>

      {hasPlaybackError && (
        <p
          role="alert"
          className="mt-2 rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)"
        >
          This exact audio source could not be played. The source has not been changed.
        </p>
      )}
    </div>
  );
}
