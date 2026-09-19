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
import { ImagePreview } from "../../images/components/ImagePreview";
import { AudioPlayer } from "../../audio/components/AudioPlayer";
import { getAudioPlaybackUrl } from "../../audio/services/audioApi";
import { EmbedVideoPlayer } from "../../media/components/EmbedVideoPlayer";
import { getNoteSourceTitle } from "../../notes/services/noteApi";
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
        "SOURCE_PREVIEW" ||
      note?.sourceType !==
        "YOUTUBE"
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
    note?.sourceType,
    note?.timestampSeconds,
    navigationMode,
  ]);

  const sourceTitle =
    note
      ? getNoteSourceTitle(note)
      : "Source";
  const isImageSource =
    note?.sourceType === "IMAGE";
  const isAudioSource =
    note?.sourceType === "AUDIO";
  const backPath = isImageSource
    ? "/images"
    : isAudioSource
      ? "/audio"
      : "/library";
  const backLabel = isImageSource
    ? "Images"
    : isAudioSource
      ? "Audio"
      : "Library";

  const showHistoricalContext =
    Boolean(note) &&
    (
      navigationMode ===
        "SOURCE_PREVIEW" ||
      navigationMode ===
        "VIDEO_UNAVAILABLE"
    );

  return (
    <main className="h-full overflow-y-auto overscroll-contain bg-(--app-bg) p-4 text-(--text-primary) sm:p-6">
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() =>
            navigate(backPath)
          }
          className="flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
        >
          <ArrowLeft
            size={15}
            aria-hidden="true"
          />
          Back to {backLabel}
        </button>

        <header className="mt-6">
          <p className="text-xs font-medium uppercase tracking-wider text-(--text-muted)">
            Exact Source Preview
          </p>

          <h1 className="mt-2 wrap-break-word text-xl font-semibold sm:text-2xl">
            {sourceTitle}
          </h1>

          {note?.youtubeSource?.channelName && (
            <p className="mt-1 text-sm text-(--text-muted)">
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
            className="mt-8 flex min-h-56 items-center justify-center rounded-2xl border border-(--border) bg-(--surface) p-8"
          >
            <div className="text-center">
              <LoaderCircle
                size={24}
                className="mx-auto animate-spin text-(--text-muted)"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm text-(--text-muted)">
                Resolving exact source...
              </p>
            </div>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mt-8 rounded-2xl border border-(--danger-border) bg-(--danger-surface) p-5"
          >
            <p className="text-sm font-medium text-(--danger-text)">
              Could not restore source context
            </p>

            <p className="mt-2 text-sm text-(--danger-text)">
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
              className="mt-4 rounded-xl border border-(--danger-border) px-3 py-2 text-xs text-(--danger-text) transition hover:bg-(--danger-surface) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--danger-ring) disabled:cursor-not-allowed disabled:opacity-50"
            >
              Try again
            </button>
          </div>
        ) : navigationMode ===
            "VIDEO_UNAVAILABLE" ? (
          <div
            role="status"
            className="mt-8 flex aspect-video items-center justify-center rounded-3xl border border-(--danger-border) bg-(--surface) p-6 sm:p-8"
          >
            <div className="max-w-md text-center">
              <TriangleAlert
                size={44}
                className="mx-auto text-(--danger-text)"
                aria-hidden="true"
              />

              <h2 className="mt-4 text-lg font-semibold">
                Exact source unavailable
              </h2>

              <p className="mt-2 text-sm leading-6 text-(--text-muted)">
                Life Lab preserved this Note and its exact
                YouTube source reference, but that source is
                not currently playable.
              </p>

              <p className="mt-3 text-xs leading-5 text-(--text-muted)">
                No similar or replacement video is used.
              </p>
            </div>
          </div>
        ) : note &&
          navigationMode ===
            "SOURCE_PREVIEW" &&
          note.sourceType === "IMAGE" &&
          note.imageSource ? (
          <div className="mt-8 flex min-h-80 items-center justify-center overflow-hidden rounded-3xl border border-(--border) bg-(--surface) sm:min-h-120">
            <ImagePreview
              sourceId={note.imageSource.id}
              origin={note.imageSource.origin}
              url={note.imageSource.url}
              alt={sourceTitle}
              className="max-h-[75vh] w-full object-contain"
            />
          </div>
        ) : note &&
          navigationMode ===
            "SOURCE_PREVIEW" &&
          note.sourceType === "AUDIO" &&
          note.audioSource ? (
          <div className="mt-8 rounded-3xl border border-(--border) bg-(--surface) p-5 sm:p-8">
            <AudioPlayer
              url={getAudioPlaybackUrl(
                note.audioSource.id,
                note.audioSource.origin,
                note.audioSource.url,
              )}
              title={sourceTitle}
              seekToSeconds={note.timestampSeconds}
            />
            {note.audioSource.origin === "EXTERNAL" && (
              <p className="mt-4 break-all text-xs leading-5 text-(--text-muted)">
                {note.audioSource.url}
              </p>
            )}
          </div>
        ) : note &&
          navigationMode ===
            "SOURCE_PREVIEW" &&
          note.sourceType === "YOUTUBE" &&
          note.youtubeSource ? (
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
            <section className="mt-5 rounded-2xl border border-(--border) bg-(--surface) p-4">
              <div className="flex items-center gap-2 text-sm text-(--text-secondary)">
                <ExternalLink
                  size={14}
                  aria-hidden="true"
                />

                Exact historical context
              </div>

              <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-(--text-secondary)">
                {note.content}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
                  <p className="text-[11px] font-medium text-(--text-muted)">
                    Timestamp
                  </p>

                  <p className="mt-1 text-sm text-(--text-secondary)">
                    {note.timestampSeconds !==
                    null
                      ? formatTime(
                          note.timestampSeconds,
                        )
                      : "Not recorded"}
                  </p>
                </div>

                <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
                  <p className="text-[11px] font-medium text-(--text-muted)">
                    Source mode
                  </p>

                  <p className="mt-1 text-sm text-(--text-secondary)">
                    {navigationMode ===
                    "SOURCE_PREVIEW"
                      ? "Read-only preview"
                      : "Unavailable source"}
                  </p>
                </div>
              </div>

              {navigationMode ===
                "SOURCE_PREVIEW" &&
                (note.sourceType ===
                  "YOUTUBE" ||
                  note.sourceType ===
                    "AUDIO") && (
                <p className="mt-3 text-xs leading-5 text-(--text-muted)">
                  Source Preview playback does not create media
                  history or listening statistics.
                </p>
              )}
            </section>
          )}
      </div>
    </main>
  );
}
