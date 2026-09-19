import {
  ArrowLeft,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ApiError } from "../../../lib/api";
import { useContextStore } from "../../../stores/contextStore";
import { formatTime } from "../../../utils/formatTime";
import { AudioPlayer } from "../components/AudioPlayer";
import {
  getAudioPlaybackUrl,
  getLibraryAudio,
  getLibraryAudioTitle,
  removeLibraryAudio,
  type LibraryAudio,
} from "../services/audioApi";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const details = Object.values(
      error.fieldErrors,
    ).filter(Boolean);

    return details.length > 0
      ? details.join(" ")
      : error.message;
  }

  return "Something went wrong.";
}

function getWorkspaceTitle(
  audio: LibraryAudio,
) {
  const title =
    getLibraryAudioTitle(audio);

  /*
   * External media can fall back to its raw URL as
   * the Library title. Keep the exact URL in metadata
   * instead of letting it dominate the page heading.
   */
  if (
    audio.origin === "EXTERNAL" &&
    audio.url &&
    title === audio.url
  ) {
    return "External audio";
  }

  return title;
}

export function AudioWorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { audioId } = useParams();

  const parsedAudioId =
    Number(audioId);

  const validAudioId =
    Number.isSafeInteger(
      parsedAudioId,
    ) &&
    parsedAudioId > 0;

  const playerRef =
    useRef<HTMLAudioElement | null>(
      null,
    );

  const [
    audio,
    setAudio,
  ] =
    useState<LibraryAudio | null>(
      null,
    );

  const [
    reliablePosition,
    setReliablePosition,
  ] =
    useState<number | null>(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] = useState(validAudioId);

  const [
    isRemoving,
    setIsRemoving,
  ] = useState(false);

  const [
    confirmRemove,
    setConfirmRemove,
  ] = useState(false);

  const [
    loadError,
    setLoadError,
  ] =
    useState<string | null>(
      null,
    );

  const [
    actionError,
    setActionError,
  ] =
    useState<string | null>(
      null,
    );

  const clearActiveContext =
    useContextStore(
      (state) =>
        state.clearActiveContext,
    );

  const setActiveContext =
    useContextStore(
      (state) =>
        state.setActiveContext,
    );

  useEffect(() => {
    clearActiveContext();

    return () => {
      const current =
        useContextStore.getState()
          .activeContext;

      if (
        current?.entityType ===
          "audio" &&
        current.entityId ===
          String(parsedAudioId)
      ) {
        useContextStore
          .getState()
          .clearActiveContext();
      }
    };
  }, [
    clearActiveContext,
    parsedAudioId,
  ]);

  const loadWorkspace =
    useCallback(async () => {
      if (!validAudioId) {
        return;
      }

      await Promise.resolve();

      setReliablePosition(null);
      setIsLoading(true);
      setLoadError(null);

      try {
        const nextAudio =
          await getLibraryAudio(
            parsedAudioId,
          );

        const title =
          getWorkspaceTitle(
            nextAudio,
          );

        setAudio(nextAudio);

        setActiveContext({
          entityId: String(
            nextAudio.id,
          ),
          entityType: "audio",
          title,
        });
      } catch (error) {
        setLoadError(
          getErrorMessage(error),
        );
      } finally {
        setIsLoading(false);
      }
    }, [
      parsedAudioId,
      setActiveContext,
      validAudioId,
    ]);

  useEffect(() => {
    const timer =
      window.setTimeout(
        () =>
          void loadWorkspace(),
        0,
      );

    return () =>
      window.clearTimeout(timer);
  }, [loadWorkspace]);

  if (!validAudioId) {
    return (
      <Navigate
        to="/audio"
        replace
      />
    );
  }

  async function handleRemove() {
    if (isRemoving) {
      return;
    }

    setIsRemoving(true);
    setActionError(null);

    try {
      await removeLibraryAudio(
        parsedAudioId,
      );

      navigate("/audio", {
        replace: true,
      });
    } catch (error) {
      setActionError(
        getErrorMessage(error),
      );
    } finally {
      setIsRemoving(false);
    }
  }

  function handleReliablePosition(
    seconds: number,
  ) {
    setReliablePosition(seconds);

    const context =
      useContextStore.getState()
        .activeContext;

    if (
      context?.entityType ===
        "audio" &&
      context.entityId ===
        String(parsedAudioId)
    ) {
      useContextStore
        .getState()
        .setTimestamp(seconds);
    }
  }

  const displayTitle = audio
    ? getWorkspaceTitle(audio)
    : "Audio";

  const playbackUrl = audio
    ? getAudioPlaybackUrl(
        audio.sourceId,
        audio.origin,
        audio.url,
      )
    : "";

  const navigationState =
    location.state as {
      audioWorkspaceRestore?: {
        libraryAudioId: number;
        noteId: number;
        timestampSeconds:
          | number
          | null;
      };
    } | null;

  const restoreRequest =
    navigationState
      ?.audioWorkspaceRestore
      ?.libraryAudioId ===
    parsedAudioId
      ? navigationState
          .audioWorkspaceRestore
      : null;

  const sourceLabel =
    audio?.origin === "UPLOAD"
      ? "Uploaded file"
      : "External URL";

  const sourceValue =
    audio?.origin === "UPLOAD"
      ? audio.originalFilename
      : audio?.url;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              navigate("/audio")
            }
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
          >
            <ArrowLeft
              size={15}
              aria-hidden="true"
            />
            Back to Audio
          </button>

          {audio && (
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setConfirmRemove(true);
              }}
              disabled={isRemoving}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-muted) transition hover:border-(--danger-border) hover:bg-(--danger-surface) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2
                size={14}
                aria-hidden="true"
              />
              Remove from Library
            </button>
          )}
        </div>

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-5 flex min-h-72 items-center justify-center rounded-2xl border border-(--border) bg-(--surface)"
          >
            <div className="text-center">
              <LoaderCircle
                size={22}
                className="mx-auto animate-spin text-(--text-muted)"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm text-(--text-muted)">
                Loading audio
                workspace...
              </p>
            </div>
          </div>
        ) : loadError ? (
          <div className="mt-5 rounded-2xl border border-(--danger-border) bg-(--danger-surface) p-5">
            <p
              role="alert"
              className="text-sm text-(--danger-text)"
            >
              {loadError}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadWorkspace()
              }
              className="mt-4 rounded-lg border border-(--danger-border) px-3 py-2 text-xs font-medium text-(--danger-text) transition hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
            >
              Try again
            </button>
          </div>
        ) : audio ? (
          <>
            <header className="mt-6 min-w-0 border-b border-(--border) pb-5">
              <div className="flex min-w-0 flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-(--text-muted)">
                  Audio workspace
                </p>

                <h1 className="max-w-4xl wrap-break-word text-xl font-semibold leading-tight text-(--text-primary) sm:text-2xl">
                  {displayTitle}
                </h1>

                <p className="max-w-2xl text-sm leading-6 text-(--text-secondary)">
                  Listen, capture an exact
                  timestamp, and keep Notes
                  and Tasks connected to this
                  source.
                </p>
              </div>
            </header>

            {actionError && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) p-3 text-sm text-(--danger-text)"
              >
                {actionError}
              </p>
            )}

            <section
              aria-label="Audio source"
              className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-(--border) bg-(--surface)"
            >
              <div className="p-4 sm:p-5 lg:p-6">
                <AudioPlayer
                  url={playbackUrl}
                  title={displayTitle}
                  playerRef={playerRef}
                  seekToSeconds={
                    restoreRequest
                      ?.timestampSeconds ??
                    null
                  }
                  seekRequestKey={
                    restoreRequest
                      ? `${restoreRequest.noteId}:${location.key}`
                      : "ordinary-navigation"
                  }
                  onReliablePosition={
                    handleReliablePosition
                  }
                />
              </div>

              <div className="border-t border-(--border) bg-(--surface-subtle) p-4 sm:p-5">
                <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                      Source type
                    </dt>

                    <dd className="mt-1 text-sm text-(--text-secondary)">
                      {audio.origin ===
                      "UPLOAD"
                        ? "Uploaded audio"
                        : "External audio"}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                      Note timestamp
                    </dt>

                    <dd className="mt-1 text-sm text-(--text-secondary)">
                      {reliablePosition !==
                      null
                        ? formatTime(
                            reliablePosition,
                          )
                        : "Not established yet"}
                    </dd>
                  </div>

                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                      {sourceLabel}
                    </dt>

                    <dd
                      className="mt-1 max-h-24 overflow-y-auto break-all font-mono text-xs leading-5 text-(--text-secondary)"
                      title={
                        sourceValue ??
                        undefined
                      }
                    >
                      {sourceValue ||
                        "Unavailable"}
                    </dd>
                  </div>
                </dl>

                <p className="mt-4 border-t border-(--border) pt-4 text-xs leading-5 text-(--text-muted)">
                  {reliablePosition !==
                  null
                    ? `Current reliable position: ${formatTime(
                        reliablePosition,
                      )}. New timestamped Notes can use this exact position.`
                    : "Play or load the audio to establish a reliable timestamp before capturing a timestamped Note."}
                </p>
              </div>
            </section>
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this audio from Library?"
        description="This removes only the Library entry. Existing Notes and Tasks keep the exact audio source for Source Preview."
        confirmLabel="Remove from Library"
        isBusy={isRemoving}
        errorMessage={actionError}
        onCancel={() => {
          if (!isRemoving) {
            setConfirmRemove(false);
            setActionError(null);
          }
        }}
        onConfirm={handleRemove}
      />
    </main>
  );
}
