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
      className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
    >
      <div className="mb-4">
        <h4 className="font-medium">
          Add YouTube Video
        </h4>

        <p className="mt-1 text-sm text-neutral-500">
          Paste a YouTube URL. Life Lab will retrieve the
          source metadata automatically.
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
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
            autoComplete="off"
            aria-invalid={Boolean(youtubeUrlError)}
            aria-describedby={
              youtubeUrlError
                ? "youtube-video-url-error"
                : undefined
            }
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none transition placeholder:text-neutral-600 focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
          />

          {youtubeUrlError && (
            <p
              id="youtube-video-url-error"
              role="alert"
              className="mt-1.5 text-xs text-red-400"
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
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMutating ? (
            <LoaderCircle
              size={16}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <Plus
              size={16}
              aria-hidden="true"
            />
          )}

          <span className="whitespace-nowrap">
            {isMutating
              ? "Adding..."
              : "Add Video"}
          </span>
        </button>
      </div>
    </form>
  );
}