import type { RefObject } from "react";

import {
  ChevronLeft,
  ChevronRight,
  Film,
  Play,
  SkipBack,
  SkipForward,
  TriangleAlert,
  X,
} from "lucide-react";

import { formatTime } from "../../../utils/formatTime";
import {
  getLibraryVideoDisplayTitle,
  type LibraryVideo,
} from "../services/libraryApi";
import { EmbedVideoPlayer } from "./EmbedVideoPlayer";

interface VideoStageProps {
  activeVideo?: LibraryVideo;
  firstVideo?: LibraryVideo;
  isVideoUnavailable: boolean;

  playerRef: RefObject<HTMLVideoElement | null>;

  onOpenVideo: (video: LibraryVideo) => void;
  onCloseVideo: () => void;

  onTimeUpdate: (timestamp: number) => void;
  onPlaying: () => void;
  onPause: () => void;
  onWaiting: () => void;
  onEnded: () => void;
  timestamp?: number;
  previousVideo?: LibraryVideo;
  nextVideo?: LibraryVideo;
  onDecreaseTimestamp: () => void;
  onIncreaseTimestamp: () => void;
}

export function VideoStage({
  activeVideo,
  firstVideo,
  isVideoUnavailable,
  playerRef,
  onOpenVideo,
  onCloseVideo,
  onTimeUpdate,
  onPlaying,
  onPause,
  onWaiting,
  onEnded,
  timestamp,
  previousVideo,
  nextVideo,
  onDecreaseTimestamp,
  onIncreaseTimestamp,
}: VideoStageProps) {
  if (!activeVideo) {
    return (
      <section className="flex aspect-video min-h-64 items-center justify-center rounded-3xl border border-(--border) bg-(--surface) p-6 shadow-2xl">
        <div className="max-w-lg text-center">
          <Film
            className="mx-auto mb-4 text-(--text-muted)"
            size={56}
            aria-hidden="true"
          />

          <h3 className="text-lg font-semibold sm:text-xl">
            Video Area
          </h3>

          <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
            Chọn một video trong Library để bắt đầu xem
            và ghi note theo context.
          </p>

          {firstVideo ? (
            <button
              type="button"
              onClick={() =>
                onOpenVideo(firstVideo)
              }
              className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
            >
              <Play
                size={16}
                aria-hidden="true"
              />
              Open first video
            </button>
          ) : (
            <p
              role="status"
              className="mt-5 text-sm text-(--text-muted)"
            >
              Chưa có video nào. Hãy thêm YouTube video
              vào Library bên dưới.
            </p>
          )}
        </div>
      </section>
    );
  }

  const displayTitle =
    getLibraryVideoDisplayTitle(activeVideo);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3
            className="wrap-break-word text-lg font-semibold sm:text-xl"
            title={displayTitle}
          >
            {displayTitle}
          </h3>

          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-(--text-muted)">
            {activeVideo.youtubeSource.channelName && (
              <span className="max-w-full truncate">
                {activeVideo.youtubeSource.channelName}
              </span>
            )}

            {activeVideo.youtubeSource.channelName && (
              <span aria-hidden="true">
                •
              </span>
            )}

            <span className="wrap-break-word">
              {
                activeVideo.youtubeSource
                  .youtubeVideoId
              }
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onCloseVideo}
          className="flex shrink-0 items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
        >
          <X
            size={16}
            aria-hidden="true"
          />
          Close video
        </button>
      </div>

      <div className="mx-auto max-w-5xl">
        {isVideoUnavailable ? (
          <div
            role="status"
            className="flex aspect-video min-h-64 items-center justify-center rounded-3xl border border-(--danger-border) bg-(--app-bg) p-6"
          >
            <div className="max-w-md text-center">
              <TriangleAlert
                size={42}
                className="mx-auto text-(--danger-text)"
                aria-hidden="true"
              />

              <h4 className="mt-4 text-lg font-semibold">
                Video unavailable
              </h4>

              <p className="mt-2 text-sm leading-6 text-(--text-muted)">
                This exact YouTube source is no longer
                available. Life Lab keeps the source
                reference and related context instead of
                replacing it with another video.
              </p>
            </div>
          </div>
        ) : (
          <EmbedVideoPlayer
            title={displayTitle}
            url={activeVideo.youtubeSource.sourceUrl}
            playerRef={playerRef}
            onTimeUpdate={onTimeUpdate}
            onPlaying={onPlaying}
            onPause={onPause}
            onWaiting={onWaiting}
            onEnded={onEnded}
          />
        )}

        {!isVideoUnavailable && (
          <nav
            aria-label="Video navigation"
            className="mt-3 flex flex-wrap items-center justify-center gap-1 rounded-xl bg-(--surface) p-2"
          >
            <button
              type="button"
              onClick={() => previousVideo && onOpenVideo(previousVideo)}
              disabled={!previousVideo}
              className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ChevronLeft size={15} aria-hidden="true" />
              Previous
            </button>

            <button
              type="button"
              onClick={onDecreaseTimestamp}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
              aria-label="Go back 10 seconds"
              title="Back 10 seconds"
            >
              <SkipBack size={15} aria-hidden="true" />
            </button>

            <span className="min-w-16 px-2 text-center text-sm font-medium tabular-nums text-(--text-primary)">
              {formatTime(timestamp)}
            </span>

            <button
              type="button"
              onClick={onIncreaseTimestamp}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
              aria-label="Go forward 10 seconds"
              title="Forward 10 seconds"
            >
              <SkipForward size={15} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => nextVideo && onOpenVideo(nextVideo)}
              disabled={!nextVideo}
              className="flex items-center gap-1 rounded-lg px-2.5 py-2 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-35"
            >
              Next
              <ChevronRight size={15} aria-hidden="true" />
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
