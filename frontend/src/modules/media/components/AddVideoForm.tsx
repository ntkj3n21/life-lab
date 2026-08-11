import { useState } from "react";
import { Plus } from "lucide-react";

import { useVideoStore } from "../../../stores/videoStore";
import type { VideoItem } from "../../../types/lifeLab";

interface AddVideoFormProps {
  onVideoAdded?: (video: VideoItem) => void;
}

export function AddVideoForm({ onVideoAdded }: AddVideoFormProps) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [tagsText, setTagsText] = useState("");

  const addVideo = useVideoStore((state) => state.addVideo);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle || !trimmedUrl) return;

    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

    const newVideo = addVideo({
      title: trimmedTitle,
      url: trimmedUrl,
      tags,
    });

    setTitle("");
    setUrl("");
    setTagsText("");

    onVideoAdded?.(newVideo);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
    >
      <div className="mb-4">
        <h4 className="font-medium">Add Video</h4>
        <p className="mt-1 text-sm text-neutral-500">
          Add a YouTube link or valid embed URL.
        </p>
      </div>

      <div className="grid min-w-0 gap-3 lg:grid-cols-[1fr_1.4fr_1fr_auto]">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          placeholder="Video title"
        />

        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          placeholder="YouTube link or embed URL"
        />

        <input
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          placeholder="Tags"
        />

        <button
          type="submit"
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          <Plus size={16} />
          <span className="whitespace-nowrap">Add</span>
        </button>
      </div>
    </form>
  );
}
