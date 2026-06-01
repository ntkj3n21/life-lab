import { Film, Play } from "lucide-react";

import { mockVideos } from "../../../mock/mockVideos";
import { useContextStore } from "../../../stores/contextStore";

export function VideoWorkspace() {
  const activeContext = useContextStore((state) => state.activeContext);
  const setActiveContext = useContextStore((state) => state.setActiveContext);

  const demoVideo = mockVideos[0];

  function handleOpenDemoVideo() {
    setActiveContext({
      entityId: demoVideo.id,
      entityType: demoVideo.type,
      title: demoVideo.title,
      timestamp: 0,
    });
  }

  const isVideoActive = activeContext?.entityType === "video";

  return (
    <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto p-6">
      <div className="flex aspect-video items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl">
        <div className="text-center">
          <Film className="mx-auto mb-4 text-neutral-500" size={56} />

          <h3 className="text-xl font-semibold">
            {isVideoActive ? activeContext.title : "Video Area"}
          </h3>

          <p className="mt-2 max-w-md text-sm text-neutral-400">
            {isVideoActive
              ? "Video demo đã được mở. Bây giờ note sẽ tự gắn với video này."
              : "Sau này đây sẽ là nơi xem video local hoặc embed hợp lệ."}
          </p>

          <button
            onClick={handleOpenDemoVideo}
            className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            <Play size={16} />
            Open demo video
          </button>
        </div>
      </div>

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
                  {activeContext.timestamp ?? 0}s
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
          <h4 className="font-medium">Library</h4>
          <p className="mt-2 text-sm text-neutral-400">
            Demo video: {demoVideo.title}
          </p>
        </div>
      </div>
    </div>
  );
}