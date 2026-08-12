import {
  ArrowLeft,
  ExternalLink,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";
import {
  useEffect,
  useRef,
} from "react";
import { useNavigate } from "react-router-dom";

import {
  useReverseContextStore,
} from "../../../stores/reverseContextStore";
import {
  formatTime,
} from "../../../utils/formatTime";
import { EmbedVideoPlayer } from "../../media/components/EmbedVideoPlayer";
import {
  useReverseContextNavigation,
} from "../hooks/useReverseContextNavigation";

interface SourcePreviewPageProps {
  noteId: number;
}

export function SourcePreviewPage({
  noteId,
}: SourcePreviewPageProps) {
  const navigate = useNavigate();

  const playerRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const resolution =
    useReverseContextStore(
      (state) =>
        state.resolution,
    );

  const isResolving =
    useReverseContextStore(
      (state) =>
        state.isResolving,
    );

  const error =
    useReverseContextStore(
      (state) =>
        state.error,
    );

  const {
    openNoteContext,
  } =
    useReverseContextNavigation();

  const note =
    resolution?.note?.id ===
    noteId
      ? resolution.note
      : null;

  const navigationMode =
    note
      ? resolution?.navigationMode
      : null;

  useEffect(() => {
    if (
      note &&
      (
        navigationMode ===
          "SOURCE_PREVIEW" ||
        navigationMode ===
          "VIDEO_UNAVAILABLE"
      )
    ) {
      return;
    }

    void openNoteContext(
      noteId,
    ).catch(() => {
      // reverseContextStore keeps error.
    });
  }, [
    noteId,
    note,
    navigationMode,
    openNoteContext,
  ]);

  /*
   * Source Preview seeks only when the historical
   * Note actually recorded a timestamp.
   *
   * Missing timestamp remains missing; never guess 0.
   */
  useEffect(() => {
    const player =
      playerRef.current;

    if (
      !player ||
      navigationMode !==
        "SOURCE_PREVIEW"
    ) {
      return;
    }

    const timestamp =
      note?.timestampSeconds;

    if (
      typeof timestamp !==
      "number"
    ) {
      return;
    }

    try {
      player.currentTime =
        timestamp;
    } catch (error) {
      console.error(
        "Failed to seek source preview timestamp:",
        error,
      );
    }
  }, [
    note?.id,
    note?.timestampSeconds,
    navigationMode,
  ]);

  const sourceTitle =
    note?.youtubeSource.title ??
    note?.youtubeSource.youtubeVideoId ??
    "Source Preview";

  const showHistoricalContext =
    Boolean(note) &&
    (
      navigationMode ===
        "SOURCE_PREVIEW" ||
      navigationMode ===
        "VIDEO_UNAVAILABLE"
    );

  return (
    <main className="min-h-screen bg-neutral-950 p-4 text-neutral-100 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() =>
            navigate("/library")
          }
          className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600"
        >
          <ArrowLeft
            size={15}
            aria-hidden="true"
          />
          Back to Library
        </button>

        <header className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">
            Exact Source Preview
          </p>

          <h1 className="mt-2 wrap-break-word text-xl font-semibold sm:text-2xl">
            {sourceTitle}
          </h1>

          {note?.youtubeSource
            .channelName && (
            <p className="mt-1 text-sm text-neutral-500">
              {
                note.youtubeSource
                  .channelName
              }
            </p>
          )}
        </header>

        {isResolving &&
        !note ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-8 flex min-h-56 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900 p-8"
          >
            <div className="text-center">
              <LoaderCircle
                size={24}
                className="mx-auto animate-spin text-neutral-500"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm text-neutral-500">
                Resolving exact source...
              </p>
            </div>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-red-900/60 bg-red-950/30 p-5"
          >
            <p className="text-sm font-medium text-red-300">
              Could not restore source context
            </p>

            <p className="mt-2 text-sm text-red-300/80">
              {error.message}
            </p>

            <button
              type="button"
              onClick={() =>
                void openNoteContext(
                  noteId,
                ).catch(() => {
                  // reverseContextStore keeps error.
                })
              }
              disabled={isResolving}
              className="mt-4 rounded-xl border border-red-900/70 px-3 py-2 text-xs text-red-200 transition hover:bg-red-950/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Try again
            </button>
          </div>
        ) : navigationMode ===
            "VIDEO_UNAVAILABLE" ? (
          <div
            role="status"
            className="mt-8 flex aspect-video items-center justify-center rounded-3xl border border-red-950/70 bg-neutral-900 p-6 sm:p-8"
          >
            <div className="max-w-md text-center">
              <TriangleAlert
                size={44}
                className="mx-auto text-red-400"
                aria-hidden="true"
              />

              <h2 className="mt-4 text-lg font-semibold">
                Exact source unavailable
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Life Lab preserved this Note and its exact
                YouTube source reference, but that source is
                not currently playable.
              </p>

              <p className="mt-3 text-xs leading-5 text-neutral-600">
                No similar or replacement video is used.
              </p>
            </div>
          </div>
        ) : note &&
          navigationMode ===
            "SOURCE_PREVIEW" ? (
          <div className="mt-8">
            <EmbedVideoPlayer
              title={sourceTitle}
              url={
                note.youtubeSource
                  .sourceUrl
              }
              playerRef={
                playerRef
              }
              onTimeUpdate={() => {
                /*
                 * Intentionally empty.
                 *
                 * Source Preview does NOT create or update
                 * WatchSession.
                 */
              }}
            />
          </div>
        ) : null}

        {showHistoricalContext &&
          note && (
            <section className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <ExternalLink
                  size={14}
                  aria-hidden="true"
                />

                Exact historical context
              </div>

              <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-neutral-300">
                {note.content}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Timestamp
                  </p>

                  <p className="mt-1 text-sm text-neutral-300">
                    {note.timestampSeconds !==
                    null
                      ? formatTime(
                          note.timestampSeconds,
                        )
                      : "Not recorded"}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Source mode
                  </p>

                  <p className="mt-1 text-sm text-neutral-300">
                    {navigationMode ===
                    "SOURCE_PREVIEW"
                      ? "Read-only preview"
                      : "Unavailable source"}
                  </p>
                </div>
              </div>

              {navigationMode ===
                "SOURCE_PREVIEW" && (
                <p className="mt-3 text-xs leading-5 text-neutral-600">
                  Preview playback is intentionally excluded
                  from WatchSession tracking.
                </p>
              )}
            </section>
          )}
      </div>
    </main>
  );
}