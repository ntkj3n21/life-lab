import type { RefObject } from "react";

import {
  Film,
  Play,
  TriangleAlert,
  X,
} from "lucide-react";

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
}: VideoStageProps) {
  if (!activeVideo) {
    return (
      <section className="flex aspect-video min-h-64 items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl">
        <div className="max-w-lg text-center">
          <Film
            className="mx-auto mb-4 text-neutral-500"
            size={56}
            aria-hidden="true"
          />

          <h3 className="text-lg font-semibold sm:text-xl">
            Video Area
          </h3>

          <p className="mt-2 text-sm leading-6 text-neutral-400">
            Chọn một video trong Library để bắt đầu xem
            và ghi note theo context.
          </p>

          {firstVideo ? (
            <button
              type="button"
              onClick={() =>
                onOpenVideo(firstVideo)
              }
              className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
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
              className="mt-5 text-sm text-neutral-500"
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

          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
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
          className="flex shrink-0 items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700"
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
            className="flex aspect-video min-h-64 items-center justify-center rounded-3xl border border-red-950/70 bg-neutral-950 p-6"
          >
            <div className="max-w-md text-center">
              <TriangleAlert
                size={42}
                className="mx-auto text-red-400"
                aria-hidden="true"
              />

              <h4 className="mt-4 text-lg font-semibold">
                Video unavailable
              </h4>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
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
      </div>
    </section>
  );
}