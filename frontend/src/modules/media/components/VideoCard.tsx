import { useState } from "react";
import { Film, Trash2 } from "lucide-react";

import type { VideoItem } from "../../../types/lifeLab";

interface VideoCardProps {
  video: VideoItem;
  isActive: boolean;
  onOpen: (video: VideoItem) => void;
  onDelete: (videoId: string) => void;
  onUpdate: (videoId: string, input: { title: string; tags: string[] }) => void;
}

export function VideoCard({
  video,
  isActive,
  onOpen,
  onDelete,
  onUpdate,
}: VideoCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingTitle, setEditingTitle] = useState(video.title);
  const [editingTags, setEditingTags] = useState(video.tags?.join(", ") ?? "");

  function handleCancelEdit() {
    setIsEditing(false);
    setEditingTitle(video.title);
    setEditingTags(video.tags?.join(", ") ?? "");
  }

  function handleSaveEdit() {
    const tags = editingTags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    onUpdate(video.id, {
      title: editingTitle,
      tags,
    });

    setIsEditing(false);
  }

  return (
    <div
      className={`group rounded-2xl border p-4 transition ${
        isActive
          ? "border-white bg-neutral-800"
          : "border-neutral-800 bg-neutral-950 hover:border-neutral-700 hover:bg-neutral-900"
      }`}
    >
      {isEditing ? (
        <div>
          <div className="space-y-3">
            <input
              value={editingTitle}
              onChange={(event) => setEditingTitle(event.target.value)}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
              placeholder="Video title"
            />

            <input
              value={editingTags}
              onChange={(event) => setEditingTags(event.target.value)}
              className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
              placeholder="Tags, separated by commas"
            />
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={handleCancelEdit}
              className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
            >
              Cancel
            </button>

            <button
              onClick={handleSaveEdit}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <>
          <button onClick={() => onOpen(video)} className="w-full text-left">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-neutral-800 p-2 text-neutral-300">
                <Film size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-sm font-medium leading-5 text-neutral-100">
                    {video.title}
                  </p>

                  {isActive && (
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-950">
                      OPEN
                    </span>
                  )}
                </div>

                {video.tags && video.tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {video.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-neutral-600">No tags</p>
                )}
              </div>
            </div>
          </button>

          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white"
            >
              Edit
            </button>

            <button
              onClick={() => onDelete(video.id)}
              className="flex items-center gap-2 rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white"
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}