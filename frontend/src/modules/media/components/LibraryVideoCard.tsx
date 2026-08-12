import { useState } from "react";
import {
  Eye,
  Film,
  History,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-react";

import {
  getLibraryVideoDisplayTitle,
  type LibraryVideo,
  type UpdateLibraryVideoInput,
} from "../services/libraryApi";

import { LibraryVideoTags } from "./LibraryVideoTags";

interface LibraryVideoCardProps {
  video: LibraryVideo;
  isActive: boolean;
  isMutating: boolean;

  onOpen: (
    video: LibraryVideo,
  ) => void;

  onUpdate: (
    libraryVideoId: number,
    input:
      UpdateLibraryVideoInput,
  ) => Promise<void>;

  onDelete: (
    video: LibraryVideo,
  ) => void;
}

function formatLastWatched(
  value: string | null,
) {
  if (!value) {
    return "Never watched";
  }

  const parsed = new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return "Last watched recorded";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(parsed);
}

export function LibraryVideoCard({
  video,
  isActive,
  isMutating,
  onOpen,
  onUpdate,
  onDelete,
}: LibraryVideoCardProps) {
  const [
    isEditing,
    setIsEditing,
  ] = useState(false);

  const [
    customTitle,
    setCustomTitle,
  ] = useState(
    video.customTitle ?? "",
  );

  const [
    personalDescription,
    setPersonalDescription,
  ] = useState(
    video.personalDescription ?? "",
  );

  const [
    isSaving,
    setIsSaving,
  ] = useState(false);

  const displayTitle =
    getLibraryVideoDisplayTitle(
      video,
    );

  function handleStartEdit() {
    setCustomTitle(
      video.customTitle ?? "",
    );

    setPersonalDescription(
      video.personalDescription ??
        "",
    );

    setIsEditing(true);
  }

  function handleCancelEdit() {
    setCustomTitle(
      video.customTitle ?? "",
    );

    setPersonalDescription(
      video.personalDescription ??
        "",
    );

    setIsEditing(false);
  }

  async function handleSaveEdit() {
    if (
      isSaving ||
      isMutating
    ) {
      return;
    }

    setIsSaving(true);

    try {
      await onUpdate(
        video.id,
        {
          customTitle:
            customTitle.trim() ||
            null,

          personalDescription:
            personalDescription.trim() ||
            null,
        },
      );

      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  const availability =
    video.youtubeSource
      .availabilityStatus;

  return (
    <article
      aria-busy={
        isSaving ||
        isMutating
      }
      className={`min-w-0 overflow-hidden rounded-2xl border transition ${
        isActive
          ? "border-neutral-500 bg-neutral-800"
          : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
      }`}
    >
      <button
        type="button"
        onClick={() =>
          onOpen(video)
        }
        disabled={isEditing}
        aria-label={`Open video ${displayTitle}`}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neutral-500 disabled:cursor-default"
      >
        <div className="relative aspect-video overflow-hidden bg-neutral-900">
          {video.youtubeSource
            .thumbnailUrl ? (
            <img
              src={
                video.youtubeSource
                  .thumbnailUrl
              }
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Film
                size={36}
                className="text-neutral-700"
                aria-hidden="true"
              />
            </div>
          )}

          <div className="absolute left-2 top-2 flex flex-wrap gap-2">
            {isActive && (
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-neutral-950">
                OPEN
              </span>
            )}

            <span
              className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                availability ===
                "AVAILABLE"
                  ? "bg-emerald-950/90 text-emerald-300"
                  : availability ===
                      "UNAVAILABLE"
                    ? "bg-red-950/90 text-red-300"
                    : "bg-neutral-950/90 text-neutral-400"
              }`}
            >
              {availability}
            </span>

            {video.watched && (
              <span className="rounded-full bg-neutral-950/90 px-2 py-1 text-[10px] font-medium text-neutral-300">
                WATCHED
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="min-w-0 p-4">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor={`custom-title-${video.id}`}
                className="mb-1.5 block text-xs font-medium text-neutral-400"
              >
                Custom title
              </label>

              <input
                id={`custom-title-${video.id}`}
                value={customTitle}
                onChange={(event) =>
                  setCustomTitle(
                    event.target.value,
                  )
                }
                disabled={
                  isSaving ||
                  isMutating
                }
                maxLength={255}
                placeholder={
                  video.youtubeSource
                    .title ??
                  "Optional custom title"
                }
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor={`description-${video.id}`}
                className="mb-1.5 block text-xs font-medium text-neutral-400"
              >
                Personal description
              </label>

              <textarea
                id={`description-${video.id}`}
                value={
                  personalDescription
                }
                onChange={(event) =>
                  setPersonalDescription(
                    event.target.value,
                  )
                }
                disabled={
                  isSaving ||
                  isMutating
                }
                rows={3}
                placeholder="Optional personal description"
                className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={
                  handleCancelEdit
                }
                disabled={
                  isSaving ||
                  isMutating
                }
                className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleSaveEdit()
                }
                disabled={
                  isSaving ||
                  isMutating
                }
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving && (
                  <LoaderCircle
                    size={13}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                )}

                {isSaving
                  ? "Saving..."
                  : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() =>
                onOpen(video)
              }
              className="block min-w-0 w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700"
            >
              <h5
                className="line-clamp-2 wrap-break-word text-sm font-medium leading-5 text-neutral-100"
                title={displayTitle}
              >
                {displayTitle}
              </h5>

              {video.customTitle &&
                video.youtubeSource
                  .title && (
                  <p
                    className="mt-1 truncate text-xs text-neutral-500"
                    title={
                      video
                        .youtubeSource
                        .title
                    }
                  >
                    {
                      video
                        .youtubeSource
                        .title
                    }
                  </p>
                )}

              {video.youtubeSource
                .channelName && (
                <p
                  className="mt-2 truncate text-xs text-neutral-500"
                  title={
                    video.youtubeSource
                      .channelName
                  }
                >
                  {
                    video.youtubeSource
                      .channelName
                  }
                </p>
              )}

              {video.personalDescription && (
                <p className="mt-3 line-clamp-2 wrap-break-word text-xs leading-5 text-neutral-400">
                  {
                    video.personalDescription
                  }
                </p>
              )}
            </button>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2">
                <Eye
                  size={13}
                  className="shrink-0 text-neutral-600"
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Personal views
                  </p>

                  <p className="text-xs text-neutral-300">
                    {video.viewCount}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2">
                <History
                  size={13}
                  className="shrink-0 text-neutral-600"
                  aria-hidden="true"
                />

                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Last watched
                  </p>

                  <p
                    className="truncate text-xs text-neutral-300"
                    title={
                      formatLastWatched(
                        video.lastWatchedAt,
                      )
                    }
                  >
                    {formatLastWatched(
                      video.lastWatchedAt,
                    )}
                  </p>
                </div>
              </div>
            </div>

            <LibraryVideoTags
              libraryVideoId={
                video.id
              }
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-800 pt-3">
              <span
                className="min-w-0 flex-1 truncate text-[11px] text-neutral-600"
                title={
                  video.youtubeSource
                    .youtubeVideoId
                }
              >
                {
                  video.youtubeSource
                    .youtubeVideoId
                }
              </span>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={
                    handleStartEdit
                  }
                  disabled={isMutating}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Pencil
                    size={13}
                    aria-hidden="true"
                  />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onDelete(video)
                  }
                  disabled={isMutating}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2
                    size={13}
                    aria-hidden="true"
                  />
                  Delete
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}