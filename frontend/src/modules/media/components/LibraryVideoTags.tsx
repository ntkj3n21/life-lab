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

  const videoTagsByVideo =
    useTagStore(
      (state) =>
        state.videoTags,
    );

  const videoTags =
    useMemo(
      () =>
        videoTagsByVideo[
          libraryVideoId
        ] ?? [],
      [
        videoTagsByVideo,
        libraryVideoId,
      ],
    );

  const isMutating =
    useTagStore(
      (state) =>
        state.isMutating,
    );

  const error = useTagStore(
    (state) => state.error,
  );

  const loadTags =
    useTagStore(
      (state) =>
        state.loadTags,
    );

  const loadVideoTags =
    useTagStore(
      (state) =>
        state.loadVideoTags,
    );

  const createTag =
    useTagStore(
      (state) =>
        state.createTag,
    );

  const attachTag =
    useTagStore(
      (state) =>
        state.attachTag,
    );

  const detachTag =
    useTagStore(
      (state) =>
        state.detachTag,
    );

  const clearError =
    useTagStore(
      (state) =>
        state.clearError,
    );

  const [
    newTagName,
    setNewTagName,
  ] = useState("");

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

  const attachedIds =
    useMemo(
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
    const name =
      newTagName.trim();

    if (
      !name ||
      isMutating
    ) {
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
    <section
      aria-label="Video tags"
      aria-busy={isMutating}
      className="mt-3 min-w-0 border-t border-(--border) pt-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <TagIcon
          size={13}
          className="text-(--text-muted)"
          aria-hidden="true"
        />

        <span className="text-xs font-medium text-(--text-secondary)">
          Tags
        </span>
      </div>

      {videoTags.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {videoTags.map(
            (tag) => (
              <span
                key={tag.id}
                className="flex max-w-full min-w-0 items-center gap-1 rounded-full bg-(--surface-hover) px-2 py-1 text-[11px] text-(--text-secondary)"
              >
                <span
                  className="truncate"
                  title={tag.name}
                >
                  {tag.name}
                </span>

                <button
                  type="button"
                  disabled={
                    isMutating
                  }
                  onClick={() =>
                    void detachTag(
                      libraryVideoId,
                      tag.id,
                    )
                  }
                  aria-label={`Remove tag ${tag.name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--text-muted) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-6 xl:w-6"
                  title={`Remove ${tag.name}`}
                >
                  <X
                    size={11}
                    aria-hidden="true"
                  />
                </button>
              </span>
            ),
          )}
        </div>
      ) : (
        <p className="text-xs text-(--text-muted)">
          No tags.
        </p>
      )}

      {availableTags.length >
        0 && (
        <>
          <label
            htmlFor={`attach-tag-${libraryVideoId}`}
            className="sr-only"
          >
            Attach existing tag
          </label>

          <select
            id={`attach-tag-${libraryVideoId}`}
            defaultValue=""
            disabled={isMutating}
            onChange={(event) => {
              const tagId =
                Number(
                  event.target
                    .value,
                );

              if (
                Number.isFinite(
                  tagId,
                ) &&
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
            className="mt-3 min-h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-2 py-2 text-xs text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 xl:min-h-8"
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
        </>
      )}

      <div className="mt-2 flex min-w-0 gap-2">
        <label
          htmlFor={`new-tag-${libraryVideoId}`}
          className="sr-only"
        >
          Create new tag
        </label>

        <input
          id={`new-tag-${libraryVideoId}`}
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
          className="h-10 min-w-0 flex-1 rounded-lg border border-(--border) bg-(--surface) px-2 text-xs outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 xl:h-8"
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
          aria-label="Create and attach tag"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
          title="Create and attach tag"
        >
          <Plus
            size={13}
            aria-hidden="true"
          />
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-2 wrap-break-word text-xs text-(--danger-text)"
        >
          {error.message}
        </p>
      )}
    </section>
  );
}
