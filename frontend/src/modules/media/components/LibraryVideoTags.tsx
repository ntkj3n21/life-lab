import {
  Plus,
  Tag as TagIcon,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useTagStore } from "../../../stores/tagStore";

interface LibraryVideoTagsProps {
  libraryVideoId: number;
}

export function LibraryVideoTags({
  libraryVideoId,
}: LibraryVideoTagsProps) {
  const tags = useTagStore(
    (state) => state.tags,
  );

  const videoTagsByVideo = useTagStore(
    (state) => state.videoTags,
  );

  const videoTags = useMemo(
    () =>
      videoTagsByVideo[libraryVideoId] ?? [],
    [
      videoTagsByVideo,
      libraryVideoId,
    ],
  );

  const isMutating = useTagStore(
    (state) => state.isMutating,
  );

  const error = useTagStore(
    (state) => state.error,
  );


  const loadTags = useTagStore(
    (state) => state.loadTags,
  );

  const loadVideoTags = useTagStore(
    (state) => state.loadVideoTags,
  );

  const createTag = useTagStore(
    (state) => state.createTag,
  );

  const attachTag = useTagStore(
    (state) => state.attachTag,
  );

  const detachTag = useTagStore(
    (state) => state.detachTag,
  );

  const clearError = useTagStore(
    (state) => state.clearError,
  );

  const [newTagName, setNewTagName] =
    useState("");

  useEffect(() => {
    void loadTags().catch(() => {
      // tagStore keeps error.
    });

    void loadVideoTags(
      libraryVideoId,
    ).catch(() => {
      // tagStore keeps error.
    });
  }, [
    libraryVideoId,
    loadTags,
    loadVideoTags,
  ]);

  const attachedIds = useMemo(
    () =>
      new Set(
        videoTags.map(
          (tag) => tag.id,
        ),
      ),
    [videoTags],
  );

  const availableTags =
    tags.filter(
      (tag) =>
        !attachedIds.has(tag.id),
    );

  async function handleCreate() {
    const name = newTagName.trim();

    if (!name || isMutating) {
      return;
    }

    clearError();

    try {
      const tag =
        await createTag(name);

      await attachTag(
        libraryVideoId,
        tag.id,
      );

      setNewTagName("");
    } catch {
      // tagStore keeps error.
    }
  }

  return (
    <div className="mt-3 border-t border-neutral-800 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <TagIcon
          size={13}
          className="text-neutral-500"
        />

        <span className="text-xs font-medium text-neutral-400">
          Tags
        </span>
      </div>

      {videoTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {videoTags.map((tag) => (
            <span
              key={tag.id}
              className="flex items-center gap-1 rounded-full bg-neutral-800 px-2 py-1 text-[11px] text-neutral-300"
            >
              {tag.name}

              <button
                type="button"
                disabled={isMutating}
                onClick={() =>
                  void detachTag(
                    libraryVideoId,
                    tag.id,
                  )
                }
                className="text-neutral-500 hover:text-red-300 disabled:opacity-40"
                title={`Remove ${tag.name}`}
              >
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-neutral-600">
          No tags.
        </p>
      )}

      {availableTags.length > 0 && (
        <select
          defaultValue=""
          disabled={isMutating}
          onChange={(event) => {
            const tagId = Number(
              event.target.value,
            );

            if (
              Number.isFinite(tagId) &&
              tagId > 0
            ) {
              void attachTag(
                libraryVideoId,
                tagId,
              );

              event.target.value =
                "";
            }
          }}
          className="mt-3 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-2 text-xs text-neutral-300 outline-none"
        >
          <option value="">
            Attach existing tag...
          </option>

          {availableTags.map(
            (tag) => (
              <option
                key={tag.id}
                value={tag.id}
              >
                {tag.name}
              </option>
            ),
          )}
        </select>
      )}

      <div className="mt-2 flex gap-2">
        <input
          value={newTagName}
          disabled={isMutating}
          maxLength={100}
          onChange={(event) =>
            setNewTagName(
              event.target.value,
            )
          }
          onKeyDown={(event) => {
            if (
              event.key === "Enter"
            ) {
              event.preventDefault();
              void handleCreate();
            }
          }}
          placeholder="Create tag..."
          className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-xs outline-none placeholder:text-neutral-600"
        />

        <button
          type="button"
          disabled={
            isMutating ||
            !newTagName.trim()
          }
          onClick={() =>
            void handleCreate()
          }
          className="flex items-center justify-center rounded-lg border border-neutral-800 px-2 text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:opacity-40"
          title="Create and attach tag"
        >
          <Plus size={13} />
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-400">
          {error.message}
        </p>
      )}
    </div>
  );
}