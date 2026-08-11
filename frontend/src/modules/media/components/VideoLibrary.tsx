import { useMemo, useState } from "react";
import { Plus, Search, X } from "lucide-react";

import type { VideoItem } from "../../../types/lifeLab";
import { AddVideoForm } from "./AddVideoForm";
import { VideoCard } from "./VideoCard";

interface VideoLibraryProps {
  videos: VideoItem[];
  activeVideoId?: string;
  onOpenVideo: (video: VideoItem) => void;
  onDeleteVideo: (videoId: string) => void;
  onUpdateVideo: (
    videoId: string,
    input: { title: string; tags: string[] },
  ) => void;
}

export function VideoLibrary({
  videos,
  activeVideoId,
  onOpenVideo,
  onDeleteVideo,
  onUpdateVideo,
}: VideoLibraryProps) {
  const [searchText, setSearchText] = useState("");
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  const filteredVideos = useMemo(() => {
    const keyword = searchText.trim().toLowerCase();

    if (!keyword) {
      return videos;
    }

    return videos.filter((video) => {
      const titleMatch = video.title.toLowerCase().includes(keyword);

      const tagMatch = video.tags?.some((tag) =>
        tag.toLowerCase().includes(keyword),
      );

      return titleMatch || tagMatch;
    });
  }, [searchText, videos]);

  return (
    <div className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h4 className="font-medium">Video Library</h4>
          <p className="mt-1 text-sm text-neutral-500">
            Select a video to set the current context.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-400">
            {filteredVideos.length}/{videos.length}
          </span>

          <button
            onClick={() => setIsAddFormOpen((value) => !value)}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            {isAddFormOpen ? <X size={16} /> : <Plus size={16} />}
            <span className="whitespace-nowrap">
              {isAddFormOpen ? "Close" : "Add Video"}
            </span>
          </button>
        </div>
      </div>

      {isAddFormOpen && (
        <div className="mb-4">
          <AddVideoForm
            onVideoAdded={(video) => {
              onOpenVideo(video);
              setIsAddFormOpen(false);
            }}
          />
        </div>
      )}

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
        <Search size={16} className="text-neutral-500" />

        <input
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-600"
          placeholder="Search videos by title or tag..."
        />

        {searchText && (
          <button
            onClick={() => setSearchText("")}
            className="text-neutral-500 hover:text-white"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 p-6 text-center">
          <p className="text-sm font-medium text-neutral-300">
            No videos yet
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Add your first video to start taking contextual notes.
          </p>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 p-6 text-center">
          <p className="text-sm font-medium text-neutral-300">
            No videos found
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Try another title or tag.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
          {filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isActive={activeVideoId === video.id}
              onOpen={onOpenVideo}
              onDelete={onDeleteVideo}
              onUpdate={onUpdateVideo}
            />
          ))}
        </div>
      )}
    </div>
  );
}