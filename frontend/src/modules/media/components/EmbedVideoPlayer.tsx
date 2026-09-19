import ReactPlayer from "react-player";
import { useState } from "react";

interface EmbedVideoPlayerProps {
  title: string;
  url: string;

  playerRef: React.RefObject<HTMLVideoElement | null>;

  onTimeUpdate: (timestamp: number) => void;

  initialTimestamp?: number;
  onPlayerReady?: (initialTimestamp?: number) => void;
  onSeeked?: (timestamp: number) => void;
  onPlaying?: () => void;
  onPause?: () => void;
  onWaiting?: () => void;
  onEnded?: () => void;
}

export function EmbedVideoPlayer({
  title,
  url,
  playerRef,
  onTimeUpdate,
  initialTimestamp,
  onPlayerReady,
  onSeeked,
  onPlaying,
  onPause,
  onWaiting,
  onEnded,
}: EmbedVideoPlayerProps) {
  /*
   * Keep the mount-time context stable. YouTube can use
   * this as its initial cue position without a later
   * paused-player seek, which otherwise briefly starts
   * playback before pausing again.
   */
  const [mountTimestamp] =
    useState<number | undefined>(
      initialTimestamp,
    );

  const playbackStart =
    typeof mountTimestamp === "number" &&
    mountTimestamp > 0
      ? mountTimestamp
      : undefined;

  const [playbackUrl] = useState(() => {
    if (playbackStart === undefined) {
      return url;
    }

    const separator = url.includes("?")
      ? "&"
      : "?";

    return `${url}${separator}t=${playbackStart}s`;
  });

  return (
    <div className="aspect-video max-h-[68vh] w-full overflow-hidden rounded-3xl border border-(--border) bg-black shadow-2xl focus-within:outline-none focus-within:ring-2 focus-within:ring-(--focus)">
      <ReactPlayer
        ref={playerRef}
        src={playbackUrl}
        title={`Video player: ${title}`}
        controls
        width="100%"
        height="100%"
        onLoadedMetadata={() =>
          onPlayerReady?.(
            mountTimestamp,
          )
        }
        onSeeked={() => {
          const currentTime =
            playerRef.current?.currentTime;

          if (
            typeof currentTime !== "number" ||
            !Number.isFinite(currentTime)
          ) {
            return;
          }

          onSeeked?.(currentTime);
        }}
        onPlaying={onPlaying}
        onPause={onPause}
        onWaiting={onWaiting}
        onEnded={onEnded}
        onTimeUpdate={(event) => {
          const currentTime =
            event.currentTarget.currentTime;

          if (!Number.isFinite(currentTime)) {
            return;
          }

          onTimeUpdate(currentTime);
        }}
      />
    </div>
  );
}
