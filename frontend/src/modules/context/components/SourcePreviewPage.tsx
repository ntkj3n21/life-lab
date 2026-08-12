import {
  ArrowLeft,
  ExternalLink,
  TriangleAlert,
} from "lucide-react";

import {
  useEffect,
  useRef,
} from "react";

import { EmbedVideoPlayer } from "../../media/components/EmbedVideoPlayer";

import {
  navigateToPath,
} from "../../../lib/navigation";

import {
  useReverseContextStore,
} from "../../../stores/reverseContextStore";

import {
  useReverseContextNavigation,
} from "../hooks/useReverseContextNavigation";

import {
  formatTime,
} from "../../../utils/formatTime";

interface SourcePreviewPageProps {
  noteId: number;
}

export function SourcePreviewPage({
  noteId,
}: SourcePreviewPageProps) {
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

  useEffect(() => {
    if (
      note &&
      (
        resolution?.navigationMode ===
          "SOURCE_PREVIEW" ||
        resolution?.navigationMode ===
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
    resolution?.navigationMode,
    openNoteContext,
  ]);

  /*
   * Source Preview must seek to
   * the exact historical timestamp
   * when one exists.
   *
   * A missing timestamp remains
   * missing — never guess 0.
   */
    useEffect(() => {
    const player =
        playerRef.current;

    if (
        !player ||
        resolution?.navigationMode !==
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
    resolution?.navigationMode,
    ]);
    
  return (
    <div className="min-h-screen bg-neutral-950 p-6 text-neutral-100">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() =>
            navigateToPath(
              "/",
            )
          }
          className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-900 hover:text-white"
        >
          <ArrowLeft
            size={15}
          />
          Back to workspace
        </button>

        <div className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">
            Exact Source Preview
          </p>

          <h1 className="mt-2 text-2xl font-semibold">
            {note?.youtubeSource
              .title ??
              "Source Preview"}
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
        </div>

        {isResolving &&
        !note ? (
          <div className="mt-8 rounded-2xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-500">
            Resolving exact
            source...
          </div>
        ) : error ? (
          <div className="mt-8 rounded-2xl border border-red-900/60 bg-red-950/30 p-5">
            <p className="text-sm text-red-300">
              {error.message}
            </p>
          </div>
        ) : resolution?.navigationMode ===
            "VIDEO_UNAVAILABLE" ? (
          <div className="mt-8 flex aspect-video items-center justify-center rounded-3xl border border-red-950/70 bg-neutral-900 p-8">
            <div className="max-w-md text-center">
              <TriangleAlert
                size={44}
                className="mx-auto text-red-400"
              />

              <h2 className="mt-4 text-lg font-semibold">
                Exact source
                unavailable
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Life Lab preserved
                this Note and its
                exact YouTube source,
                but the source is no
                longer currently
                available.
              </p>
            </div>
          </div>
        ) : note &&
          resolution?.navigationMode ===
            "SOURCE_PREVIEW" ? (
          <>
            <div className="mt-8">
              <EmbedVideoPlayer
                title={
                  note.youtubeSource
                    .title ??
                  note.youtubeSource
                    .youtubeVideoId
                }
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
                   * Source Preview does
                   * NOT create or update
                   * WatchSession.
                   */
                }}
              />
            </div>

            <div className="mt-5 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
              <div className="flex items-center gap-2 text-sm text-neutral-400">
                <ExternalLink
                  size={14}
                />

                Exact historical
                context
              </div>

              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-300">
                {note.content}
              </p>

              <p className="mt-3 text-xs text-neutral-500">
                Timestamp:{" "}
                {note.timestampSeconds !==
                null
                  ? formatTime(
                      note.timestampSeconds,
                    )
                  : "Not recorded"}
              </p>

              <p className="mt-1 text-xs text-neutral-700">
                Source Preview playback
                is intentionally excluded
                from WatchSession
                tracking.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}