import { useState } from "react";
import { Plus } from "lucide-react";

import { useVideoStore } from "../../../stores/videoStore";
import { normalizeEmbedUrl } from "../services/embedService";

export function AddVideoForm() {
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

    addVideo({
    title: trimmedTitle,
    url: normalizeEmbedUrl(trimmedUrl),
    tags,
    });

    setTitle("");
    setUrl("");
    setTagsText("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
    >
      <div className="mb-4">
        <h4 className="font-medium">Add Video</h4>
        <p className="mt-1 text-sm text-neutral-500">
          Thêm video bằng embed URL hợp lệ.
        </p>
      </div>

      <div className="space-y-3">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          placeholder="Video title"
        />

        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          placeholder="YouTube link hoặc embed URL"
        />

        <input
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          placeholder="Tags, ví dụ: react, study, frontend"
        />

        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          <Plus size={16} />
          Add video
        </button>
      </div>
    </form>
  );
}