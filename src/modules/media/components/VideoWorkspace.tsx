import { useState } from "react";
import { Film, Play, Trash2, X, Clock } from "lucide-react";
import { formatTime, parseTimeToSeconds } from "../../../utils/formatTime";
import { useContextStore } from "../../../stores/contextStore";
import { useVideoStore } from "../../../stores/videoStore";
import type { VideoItem } from "../../../types/lifeLab";
import { AddVideoForm } from "./AddVideoForm";
import { EmbedVideoPlayer } from "./EmbedVideoPlayer";

export function VideoWorkspace() {
  const [timestampInput, setTimestampInput] = useState("");
  const activeContext = useContextStore((state) => state.activeContext);
  const setActiveContext = useContextStore((state) => state.setActiveContext);
  const clearActiveContext = useContextStore((state) => state.clearActiveContext);
  const setTimestamp = useContextStore((state) => state.setTimestamp);
  const increaseTimestamp = useContextStore((state) => state.increaseTimestamp);
  const decreaseTimestamp = useContextStore((state) => state.decreaseTimestamp);

  const videos = useVideoStore((state) => state.videos);
  const deleteVideo = useVideoStore((state) => state.deleteVideo);

  const activeVideo = videos.find(
    (video) => video.id === activeContext?.entityId,
  );

  function handleOpenVideo(video: VideoItem) {
    setActiveContext({
      entityId: video.id,
      entityType: video.type,
      title: video.title,
      timestamp: 0,
    });
  }

  function handleDeleteVideo(videoId: string) {
    deleteVideo(videoId);

    if (activeContext?.entityId === videoId) {
      clearActiveContext();
    }
  }

  function handleApplyTimestamp() {
    const seconds = parseTimeToSeconds(timestampInput);
    setTimestamp(seconds);
    setTimestampInput("");
  }
  
  return (
    <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto p-6">
      {activeVideo ? (
  <div>
    <div className="mb-4 flex items-center justify-between gap-4">
      <div>
        <h3 className="text-xl font-semibold">{activeVideo.title}</h3>
        <p className="mt-1 text-sm text-neutral-500">
          Video đang mở. Note mới sẽ tự gắn với video này.
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

    <EmbedVideoPlayer title={activeVideo.title} url={activeVideo.url} />

  <div className="mt-4 grid grid-cols-[1fr_260px] gap-4">
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <p className="text-sm font-medium text-neutral-300">
        Current video info
      </p>

      <p className="mt-2 break-all text-sm text-neutral-500">
        URL: {activeVideo.url}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {activeVideo.tags?.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-400"
          >
            #{tag}
          </span>
        ))}
      </div>
    </div>

    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center gap-2">
        <Clock size={16} className="text-neutral-400" />
        <p className="text-sm font-medium text-neutral-300">
          Manual timestamp
        </p>
      </div>

      <p className="mt-2 text-xs text-neutral-500">
        Nhập/chỉnh thủ công mốc thời gian muốn gắn với note.
      </p>

      <p className="mt-3 text-2xl font-semibold">
        {formatTime(activeContext?.timestamp)}
      </p>

      <div className="mt-4 flex gap-2">
        <input
          value={timestampInput}
          onChange={(event) => setTimestampInput(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          placeholder="mm:ss"
        />

        <button
          onClick={handleApplyTimestamp}
          className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Apply
        </button>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-2">
        <button
          onClick={() => decreaseTimestamp(30)}
          className="rounded-xl border border-neutral-800 px-2 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          -30s
        </button>

        <button
          onClick={() => decreaseTimestamp(5)}
          className="rounded-xl border border-neutral-800 px-2 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          -5s
        </button>

        <button
          onClick={() => setTimestamp(0)}
          className="rounded-xl border border-neutral-800 px-2 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          Reset
        </button>

        <button
          onClick={() => increaseTimestamp(5)}
          className="rounded-xl border border-neutral-800 px-2 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          +5s
        </button>

        <button
          onClick={() => increaseTimestamp(30)}
          className="rounded-xl border border-neutral-800 px-2 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white"
        >
          +30s
        </button>
      </div>
    </div>
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

      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <h4 className="font-medium">Current Context</h4>

          {activeContext ? (
            <div className="mt-2 text-sm text-neutral-400">
              <p>
                Type:{" "}
                <span className="text-neutral-200">
                  {activeContext.entityType}
                </span>
              </p>
              <p>
                Title:{" "}
                <span className="text-neutral-200">
                  {activeContext.title}
                </span>
              </p>
              <p>
                Timestamp:{" "}
                <span className="text-neutral-200">
                  {formatTime(activeContext.timestamp)}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-400">
              Chưa có video nào đang mở.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <h4 className="font-medium">Quick Actions</h4>
          <p className="mt-2 text-sm text-neutral-400">
            Add note, create todo, save timestamp.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <h4 className="font-medium">Library Summary</h4>
          <p className="mt-2 text-sm text-neutral-400">
            {videos.length} videos available.
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-[360px_1fr] gap-4">
        <AddVideoForm />

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h4 className="font-medium">Video Library</h4>
              <p className="mt-1 text-sm text-neutral-500">
                Chọn video để đổi context hiện tại.
              </p>
            </div>
          </div>

          {videos.length === 0 ? (
            <p className="text-sm text-neutral-500">Chưa có video nào.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {videos.map((video) => {
                const isActive = activeContext?.entityId === video.id;

                return (
                  <div
                    key={video.id}
                    className={`rounded-2xl border p-4 transition ${
                      isActive
                        ? "border-white bg-neutral-800"
                        : "border-neutral-800 bg-neutral-950"
                    }`}
                  >
                    <button
                      onClick={() => handleOpenVideo(video)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-neutral-800 p-2">
                          <Film size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-neutral-100">
                            {video.title}
                          </p>

                          <p className="mt-1 text-xs text-neutral-500">
                            {video.sourceType} · {video.id}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {video.tags?.map((tag) => (
                              <span
                                key={tag}
                                className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-400"
                              >
                                #{tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </button>

                    <button
                      onClick={() => handleDeleteVideo(video.id)}
                      className="mt-3 flex items-center gap-2 rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white"
                    >
                      <Trash2 size={14} />
                      Delete
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}