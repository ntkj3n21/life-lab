import { useEffect, useRef, useState } from "react";
import { Ellipsis, Film, LoaderCircle, Pencil, Tag as TagIcon, Trash2, X } from "lucide-react";

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
  viewMode: "all" | "recent" | "most";
  isActionsOpen: boolean;

  onOpen: (video: LibraryVideo) => void;

  onUpdate: (
    libraryVideoId: number,
    input: UpdateLibraryVideoInput,
  ) => Promise<void>;

  onDelete: (video: LibraryVideo) => void;

  onToggleActions: () => void;
  onCloseActions: () => void;
  onTagsChanged: () => void;
}

function formatDuration(durationSeconds: number | null) {
  if (durationSeconds === null) {
    return null;
  }

  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatLastWatched(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function LibraryVideoCard({
  video,
  isActive,
  isMutating,
  viewMode,
  isActionsOpen,
  onOpen,
  onUpdate,
  onDelete,
  onToggleActions,
  onCloseActions,
  onTagsChanged,
}: LibraryVideoCardProps) {
  const actionsRef = useRef<HTMLDivElement | null>(null);

  const actionsTriggerRef = useRef<HTMLButtonElement | null>(null);

  const [disclosure, setDisclosure] = useState<"edit" | "tags" | null>(null);

  const [customTitle, setCustomTitle] = useState(video.customTitle ?? "");

  const [personalDescription, setPersonalDescription] = useState(
    video.personalDescription ?? "",
  );

  const [isSaving, setIsSaving] = useState(false);

  const displayTitle = getLibraryVideoDisplayTitle(video);

  useEffect(() => {
    if (!isActionsOpen && disclosure === null) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (
        isActionsOpen &&
        event.target instanceof Node &&
        !actionsRef.current?.contains(event.target)
      ) {
        onCloseActions();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }

      if (isSaving || isMutating) return;
      if (isActionsOpen) onCloseActions();
      setDisclosure(null);
      window.requestAnimationFrame(() => actionsTriggerRef.current?.focus());
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isActionsOpen, disclosure, isSaving, isMutating, onCloseActions]);

  function handleStartEdit() {
    onCloseActions();

    setCustomTitle(video.customTitle ?? "");

    setPersonalDescription(video.personalDescription ?? "");

    setDisclosure("edit");
  }

  function handleCancelEdit() {
    setCustomTitle(video.customTitle ?? "");

    setPersonalDescription(video.personalDescription ?? "");

    setDisclosure(null);

    window.requestAnimationFrame(() => {
      actionsTriggerRef.current?.focus();
    });
  }

  function handleStartTags() {
    onCloseActions();
    setDisclosure("tags");
  }

  function handleCloseTags() {
    setDisclosure(null);
    window.requestAnimationFrame(() => actionsTriggerRef.current?.focus());
  }

  async function handleSaveEdit() {
    if (isSaving || isMutating) {
      return;
    }

    setIsSaving(true);

    try {
      await onUpdate(video.id, {
        customTitle: customTitle.trim() || null,

        personalDescription: personalDescription.trim() || null,
      });

      setDisclosure(null);

      window.requestAnimationFrame(() => {
        actionsTriggerRef.current?.focus();
      });
    } finally {
      setIsSaving(false);
    }
  }

  const availability = video.youtubeSource.availabilityStatus;

  const durationLabel = formatDuration(video.youtubeSource.durationSeconds);

  const watchMetadataLabel =
    viewMode === "recent" && video.lastWatchedAt
      ? `Last watched ${formatLastWatched(video.lastWatchedAt)}`
      : video.viewCount > 0
        ? `${video.viewCount} view${video.viewCount === 1 ? "" : "s"}`
        : null;

  return (
    <article
      aria-busy={isSaving || isMutating}
      className={`min-w-0 overflow-visible rounded-xl border transition ${
        isActive
          ? "border-(--border-strong) bg-(--surface-hover)"
          : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"
      }`}
    >
      <button
        type="button"
        onClick={() => onOpen(video)}
        disabled={disclosure === "edit"}
        aria-label={`Open video ${displayTitle}`}
        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--focus) disabled:cursor-default"
      >
        <div className="relative aspect-video overflow-hidden bg-(--surface)">
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
                className="text-(--text-faint)"
                aria-hidden="true"
              />
            </div>
          )}

          {availability === "UNAVAILABLE" && (
            <span className="absolute left-2 top-2 rounded-full bg-(--danger-surface) px-2 py-1 text-[11px] font-medium text-(--danger-text)">
              Unavailable
            </span>
          )}
        </div>
      </button>

      <div className="min-w-0 p-3.5">
        {disclosure === "edit" ? (
          <div className="space-y-3">
            <div>
              <label
                htmlFor={`custom-title-${video.id}`}
                className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
              >
                Title
              </label>

              <input
                id={`custom-title-${video.id}`}
                autoFocus
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                disabled={isSaving || isMutating}
                maxLength={255}
                placeholder={
                  video.youtubeSource.title ?? "Optional title"
                }
                className="w-full rounded-xl border border-(--border) bg-(--surface) px-3 py-2 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor={`description-${video.id}`}
                className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
              >
                Description
              </label>

              <textarea
                id={`description-${video.id}`}
                value={personalDescription}
                onChange={(event) => setPersonalDescription(event.target.value)}
                disabled={isSaving || isMutating}
                rows={3}
                placeholder="Optional description"
                className="w-full resize-none rounded-xl border border-(--border) bg-(--surface) px-3 py-2 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                disabled={isSaving || isMutating}
                className="min-h-10 rounded-lg border border-(--border) px-3 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-1.5"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={isSaving || isMutating}
                className="flex min-h-10 items-center gap-2 rounded-lg bg-(--primary-bg) px-3 text-xs font-medium text-(--primary-text) hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-0 sm:py-1.5"
              >
                {isSaving && (
                  <LoaderCircle
                    size={13}
                    className="animate-spin"
                    aria-hidden="true"
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
              className="block min-w-0 w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
            >
              <h5
                className="line-clamp-2 wrap-break-word text-sm font-medium leading-5 text-(--text-primary)"
                title={displayTitle}
              >
                {displayTitle}
              </h5>
            </button>

            <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-(--text-muted)">
              {video.youtubeSource.channelName && (
                <span
                  className="min-w-0 truncate"
                  title={video.youtubeSource.channelName}
                >
                  {video.youtubeSource.channelName}
                </span>
              )}

              {video.youtubeSource.channelName && durationLabel && (
                <span aria-hidden="true">·</span>
              )}

              {durationLabel && (
                <span className="shrink-0">{durationLabel}</span>
              )}
            </div>

            {disclosure === "tags" ? (
              <div className="mt-3 border-t border-(--border) pt-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-(--text-secondary)">Tags</span>
                  <button
                    type="button"
                    autoFocus
                    onClick={handleCloseTags}
                    aria-label="Close tag assignment"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-(--text-muted) hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                  ><X size={14} aria-hidden="true" /></button>
                </div>
                <LibraryVideoTags libraryVideoId={video.id} attachedTags={video.tags} onChanged={onTagsChanged} />
              </div>
            ) : (
              <>
                {video.personalDescription && (
                  <p className="mt-2 line-clamp-2 wrap-break-word text-xs leading-5 text-(--text-secondary)">
                    {video.personalDescription}
                  </p>
                )}
                {video.tags.length > 0 && (
                  <div className="mt-2 flex min-w-0 flex-wrap gap-1.5" aria-label="Video tags">
                    {video.tags.map((tag) => (
                      <span key={tag.id} title={tag.name} className="max-w-full truncate rounded-full border border-(--border) bg-(--surface-subtle) px-2 py-1 text-[11px] font-medium text-(--text-primary)">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            <div
              className={`mt-3 flex items-center gap-2 ${
                watchMetadataLabel ? "justify-between" : "justify-end"
              }`}
            >
              {watchMetadataLabel && (
                <span className="min-w-0 truncate text-[11px] text-(--text-muted)">
                  {watchMetadataLabel}
                </span>
              )}

              <div ref={actionsRef} className="relative">
                <button
                  ref={actionsTriggerRef}
                  type="button"
                  onClick={onToggleActions}
                  disabled={disclosure !== null || isMutating}
                  aria-expanded={isActionsOpen}
                  aria-controls={`library-video-actions-${video.id}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50 sm:h-7 sm:w-7"
                  aria-label={`More actions for ${displayTitle}`}
                  title="More actions"
                >
                  <Ellipsis size={16} aria-hidden="true" />
                </button>

                {isActionsOpen && (
                  <div
                    id={`library-video-actions-${video.id}`}
                    aria-label={`Actions for ${displayTitle}`}
                    role="group"
                    className="absolute bottom-12 right-0 z-10 w-48 max-w-[calc(100vw-2rem)] rounded-xl border border-(--border-strong) bg-(--surface) p-2 shadow-lg sm:bottom-9"
                  >
                      <button
                        type="button"
                        onClick={handleStartEdit}
                        disabled={isMutating}
                        className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
                      >
                        <Pencil size={13} aria-hidden="true" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={handleStartTags}
                        disabled={isMutating}
                        className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
                      >
                        <TagIcon size={13} aria-hidden="true" />
                        Tags
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onCloseActions();
                          actionsTriggerRef.current?.focus();
                          onDelete(video);
                        }}
                        disabled={isMutating}
                        className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-(--text-secondary) hover:bg-(--danger-surface) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                        Remove
                      </button>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
