import { useState } from "react";
import {
  Film,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-react";

import type {
  LibraryVideo,
  UpdateLibraryVideoInput,
} from "../services/libraryApi";
import { getLibraryVideoDisplayTitle } from "../services/libraryApi";

import { LibraryVideoTags } from "./LibraryVideoTags";

interface LibraryVideoCardProps {
  video: LibraryVideo;
  isActive: boolean;
  isMutating: boolean;

  onOpen: (video: LibraryVideo) => void;

  onUpdate: (
    libraryVideoId: number,
    input: UpdateLibraryVideoInput,
  ) => Promise<void>;

  onDelete: (video: LibraryVideo) => void;
}

export function LibraryVideoCard({
  video,
  isActive,
  isMutating,
  onOpen,
  onUpdate,
  onDelete,
}: LibraryVideoCardProps) {
  const [isEditing, setIsEditing] = useState(false);

  const [customTitle, setCustomTitle] = useState(
    video.customTitle ?? "",
  );

  const [personalDescription, setPersonalDescription] =
    useState(video.personalDescription ?? "");

  const [isSaving, setIsSaving] = useState(false);

  const displayTitle = getLibraryVideoDisplayTitle(video);

  function handleStartEdit() {
    setCustomTitle(video.customTitle ?? "");
    setPersonalDescription(
      video.personalDescription ?? "",
    );
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setCustomTitle(video.customTitle ?? "");
    setPersonalDescription(
      video.personalDescription ?? "",
    );
    setIsEditing(false);
  }

  async function handleSaveEdit() {
    if (isSaving || isMutating) {
      return;
    }

    setIsSaving(true);

    try {
      await onUpdate(video.id, {
        customTitle: customTitle.trim() || null,
        personalDescription:
          personalDescription.trim() || null,
      });

      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  }

  const availability =
    video.youtubeSource.availabilityStatus;

  return (
    <article
      className={`overflow-hidden rounded-2xl border transition ${
        isActive
          ? "border-neutral-500 bg-neutral-800"
          : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(video)}
        disabled={isEditing}
        className="block w-full text-left disabled:cursor-default"
      >
        <div className="relative aspect-video overflow-hidden bg-neutral-900">
          {video.youtubeSource.thumbnailUrl ? (
            <img
              src={video.youtubeSource.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Film
                size={36}
                className="text-neutral-700"
              />
            </div>
          )}

          <div className="absolute left-2 top-2 flex gap-2">
            {isActive && (
              <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-neutral-950">
                OPEN
              </span>
            )}

            <span
              className={`rounded-full px-2 py-1 text-[10px] font-medium ${
                availability === "AVAILABLE"
                  ? "bg-emerald-950/90 text-emerald-300"
                  : availability === "UNAVAILABLE"
                    ? "bg-red-950/90 text-red-300"
                    : "bg-neutral-950/90 text-neutral-400"
              }`}
            >
              {availability}
            </span>
          </div>
        </div>
      </button>

      <div className="p-4">
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
                  setCustomTitle(event.target.value)
                }
                disabled={isSaving || isMutating}
                maxLength={255}
                placeholder={
                  video.youtubeSource.title ??
                  "Optional custom title"
                }
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600 disabled:opacity-60"
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
                value={personalDescription}
                onChange={(event) =>
                  setPersonalDescription(
                    event.target.value,
                  )
                }
                disabled={isSaving || isMutating}
                rows={3}
                placeholder="Optional personal description"
                className="w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600 disabled:opacity-60"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving || isMutating}
                className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={isSaving || isMutating}
                className="flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
              >
                {isSaving && (
                  <LoaderCircle
                    size={13}
                    className="animate-spin"
                  />
                )}

                {isSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => onOpen(video)}
              className="block w-full text-left"
            >
              <h5 className="line-clamp-2 text-sm font-medium leading-5 text-neutral-100">
                {displayTitle}
              </h5>

              {video.customTitle &&
                video.youtubeSource.title && (
                  <p className="mt-1 line-clamp-1 text-xs text-neutral-500">
                    {video.youtubeSource.title}
                  </p>
                )}

              {video.youtubeSource.channelName && (
                <p className="mt-2 truncate text-xs text-neutral-500">
                  {video.youtubeSource.channelName}
                </p>
              )}

              {video.personalDescription && (
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-neutral-400">
                  {video.personalDescription}
                </p>
              )}
            </button>

            <LibraryVideoTags
              libraryVideoId={video.id}
            />

            <div className="mt-4 flex items-center justify-between gap-2 border-t border-neutral-800 pt-3">
              <span className="truncate text-[11px] text-neutral-600">
                {video.youtubeSource.youtubeVideoId}
              </span>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={handleStartEdit}
                  disabled={isMutating}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:opacity-50"
                >
                  <Pencil size={13} />
                  Edit
                </button>

                <button
                  type="button"
                  onClick={() => onDelete(video)}
                  disabled={isMutating}
                  className="flex items-center gap-1.5 rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-red-300 disabled:opacity-50"
                >
                  <Trash2 size={13} />
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