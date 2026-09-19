import {
  useState,
  type FormEvent,
} from "react";
import {
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
 * YouTube discovery is presented by the owning Library panel.
 * This form remains responsible only for the existing URL-based
 * Add Video operation.
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
            aria-required="true"
            aria-invalid={Boolean(youtubeUrlError)}
            aria-describedby={
              youtubeUrlError
                ? "youtube-video-url-error"
                : undefined
            }
            placeholder="Paste YouTube URL..."
            className="h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 text-sm outline-none transition placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-60 sm:h-9"
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
          className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-(--primary-bg) px-3.5 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
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

    </form>
  );
}
