import { useEffect, useRef } from "react";
import { Clock, Film, Play, X } from "lucide-react";

import { ContextSummary } from "../../../components/context/ContextSummary";
import { formatTime } from "../../../utils/formatTime";
import { useContextStore } from "../../../stores/contextStore";
import { useVideoStore } from "../../../stores/videoStore";
import type { VideoItem } from "../../../types/lifeLab";
import { EmbedVideoPlayer } from "./EmbedVideoPlayer";
import { VideoLibrary } from "./VideoLibrary";

export function VideoWorkspace() {
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const lastTrackedSecondRef = useRef<number | null>(null);
  const skipNextSeekRef = useRef(false);
  const activeContext = useContextStore((state) => state.activeContext);
  const setActiveContext = useContextStore((state) => state.setActiveContext);
  const clearActiveContext = useContextStore((state) => state.clearActiveContext);
  const setTimestamp = useContextStore((state) => state.setTimestamp);
  const increaseTimestamp = useContextStore((state) => state.increaseTimestamp);
  const decreaseTimestamp = useContextStore((state) => state.decreaseTimestamp);
  const videos = useVideoStore((state) => state.videos);
  const updateVideo = useVideoStore((state) => state.updateVideo);
  const deleteVideo = useVideoStore((state) => state.deleteVideo);

  const activeVideo = videos.find(
    (video) => video.id === activeContext?.entityId,
  );

  useEffect(() => {
    const player = playerRef.current;

    if (!player || !activeVideo) return;
    if (typeof activeContext?.timestamp !== "number") return;

    if (skipNextSeekRef.current) {
      skipNextSeekRef.current = false;
      return;
    }

    try {
      player.currentTime = activeContext.timestamp;
    } catch (error) {
      console.error("Failed to seek video timestamp:", error);
    }
  }, [activeContext?.entityId, activeContext?.timestamp, activeVideo]);

  function handleOpenVideo(video: VideoItem) {
    setActiveContext({
      entityId: video.id,
      entityType: video.type,
      title: video.title,
      timestamp: 0,
    });
  }

  function handleUpdateVideo(
    videoId: string,
    input: { title: string; tags: string[] },
  ) {
    updateVideo(videoId, input);

    if (activeContext?.entityId === videoId) {
      setActiveContext({
        ...activeContext,
        title: input.title,
      });
    }
  }

  function handleDeleteVideo(videoId: string) {
    const confirmed = window.confirm("Delete this video?");

    if (!confirmed) return;

    deleteVideo(videoId);

    if (activeContext?.entityId === videoId) {
      clearActiveContext();
    }
  }

  function handleTrackVideoTime(currentTime: number) {
    const currentSecond = Math.floor(currentTime);

    if (!activeVideo) return;
    if (lastTrackedSecondRef.current === currentSecond) return;

    lastTrackedSecondRef.current = currentSecond;
    skipNextSeekRef.current = true;
    setTimestamp(currentTime);
  }

  return (
    <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-7xl">
        {activeVideo ? (
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">{activeVideo.title}</h3>
                <p className="mt-1 text-sm text-neutral-500">
                  Notes and todos will be linked to this video.
                </p>
              </div>

              <button
                onClick={clearActiveContext}
                className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"
              >
                <X size={16} />
                Close video
              </button>
            </div>

            <div className="mx-auto max-w-5xl">
              <EmbedVideoPlayer
                title={activeVideo.title}
                url={activeVideo.url}
                playerRef={playerRef}
                onTimeUpdate={handleTrackVideoTime}
              />
            </div>
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            <div className="text-center">
              <Film className="mx-auto mb-4 text-neutral-500" size={56} />

              <h3 className="text-xl font-semibold">Video Area</h3>

              <p className="mt-2 max-w-md text-sm text-neutral-400">
                Chọn một video trong Library để bắt đầu xem và ghi note theo context.
              </p>

              {videos.length > 0 ? (
                <button
                  onClick={() => handleOpenVideo(videos[0])}
                  className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
                >
                  <Play size={16} />
                  Open first video
                </button>
              ) : (
                <p className="mt-5 text-sm text-neutral-500">
                  Chưa có video nào. Hãy thêm video mới ở form bên dưới.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-[1fr_1.4fr] gap-4">
          <ContextSummary />

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-neutral-400" />
                  <h4 className="font-medium">Capture time</h4>
                </div>

                <p className="mt-2 text-xs text-neutral-500">
                  Auto-updates while the video plays. Notes and todos use this
                  time when saved.
                </p>
              </div>

              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  activeVideo
                    ? "bg-neutral-800 text-neutral-300"
                    : "bg-neutral-950 text-neutral-600"
                }`}
              >
                {activeVideo ? "Live" : "No video"}
              </span>
            </div>

            <p className="mt-4 text-3xl font-semibold tabular-nums">
              {formatTime(activeContext?.timestamp)}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => decreaseTimestamp(5)}
                className="rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                -5s
              </button>

              <button
                onClick={() => setTimestamp(0)}
                className="rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                Reset
              </button>

              <button
                onClick={() => increaseTimestamp(5)}
                className="rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
              >
                +5s
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 w-full">
          <VideoLibrary
            videos={videos}
            activeVideoId={activeContext?.entityId}
            onOpenVideo={handleOpenVideo}
            onDeleteVideo={handleDeleteVideo}
            onUpdateVideo={handleUpdateVideo}
          />
        </div>
      </div>
    </div>
  );
}
