import {
  useState,
  type FormEvent,
} from "react";
import {
  ExternalLink,
  LoaderCircle,
  Plus,
} from "lucide-react";

import { useLibraryStore } from "../../../stores/libraryStore";
import type { LibraryVideo } from "../services/libraryApi";

interface LibraryAddVideoFormProps {
  onVideoAdded?: (video: LibraryVideo) => void;
}

/**
 * Compact "Add Video" panel (UI-03).
 *
 * Life Lab intentionally does NOT embed YouTube search here.
 * "Find on YouTube" opens YouTube in a new tab; the user copies
 * a link and pastes it back. This keeps Library Search (finding
 * saved content) and YouTube discovery (finding new content)
 * fully separate — they serve different intents.
 */
export function LibraryAddVideoForm({
  onVideoAdded,
}: LibraryAddVideoFormProps) {
  const addVideo = useLibraryStore(
    (state) => state.addVideo,
  );

  const isMutating = useLibraryStore(
    (state) => state.isMutating,
  );

  const error = useLibraryStore(
    (state) => state.error,
  );

  const clearError = useLibraryStore(
    (state) => state.clearError,
  );

  const [youtubeUrl, setYoutubeUrl] =
    useState("");

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const trimmedUrl =
      youtubeUrl.trim();

    if (
      !trimmedUrl ||
      isMutating
    ) {
      return;
    }

    clearError();

    try {
      const video =
        await addVideo(
          trimmedUrl,
        );

      setYoutubeUrl("");
      onVideoAdded?.(video);
    } catch {
      // libraryStore keeps the API error.
    }
  }

  const youtubeUrlError =
    error?.fieldErrors.youtubeUrl;

  return (
    <form
      onSubmit={handleSubmit}
      aria-busy={isMutating}
      className="rounded-[10px] border border-(--border) bg-(--panel-bg) p-3"
    >
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <label
            htmlFor="youtube-video-url"
            className="sr-only"
          >
            YouTube video URL
          </label>

          <input
            id="youtube-video-url"
            type="url"
            value={youtubeUrl}
            onChange={(event) => {
              setYoutubeUrl(
                event.target.value,
              );

              if (error) {
                clearError();
              }
            }}
            disabled={isMutating}
            autoFocus
            autoComplete="off"
            aria-invalid={Boolean(youtubeUrlError)}
            aria-describedby={
              youtubeUrlError
                ? "youtube-video-url-error"
                : undefined
            }
            placeholder="Paste YouTube URL..."
            className="h-9 w-full rounded-[8px] border border-(--border) bg-(--surface) px-3 text-sm outline-none transition placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-60"
          />

          {youtubeUrlError && (
            <p
              id="youtube-video-url-error"
              role="alert"
              className="mt-1.5 text-xs text-(--danger-text)"
            >
              {youtubeUrlError}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={
            isMutating ||
            !youtubeUrl.trim()
          }
          className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-[8px] bg-(--primary-bg) px-3.5 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMutating ? (
            <LoaderCircle
              size={14}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Plus
              size={14}
              aria-hidden="true"
            />
          )}
          Add
        </button>
      </div>

      <a
        href="https://www.youtube.com/"
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-(--text-muted) transition-colors hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
      >
        Find on YouTube
        <ExternalLink
          size={12}
          aria-hidden="true"
        />
      </a>
    </form>
  );
}
