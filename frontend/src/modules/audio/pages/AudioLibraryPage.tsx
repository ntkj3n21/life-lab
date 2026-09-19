import {
  Headphones,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  type FormEvent,
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

import { ContextSummary } from "../../../components/context/ContextSummary";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ApiError } from "../../../lib/api";
import { useContextStore } from "../../../stores/contextStore";
import { formatTime } from "../../../utils/formatTime";
import { LibraryMediaNavigation } from "../../media/components/LibraryMediaNavigation";
import { LibraryPagination } from "../../media/components/LibraryPagination";
import { AudioPlayer } from "../components/AudioPlayer";
import {
  addAudioUrl,
  getAudioLibrary,
  getAudioPlaybackUrl,
  getLibraryAudio,
  getLibraryAudioTitle,
  removeLibraryAudio,
  uploadAudio,
  type LibraryAudio,
} from "../services/audioApi";

const PAGE_SIZE = 12;

interface AudioLoadError {
  audioId: number;
  message: string;
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const details = Object.values(error.fieldErrors).filter(Boolean);

    return details.length > 0 ? details.join(" ") : error.message;
  }

  return "Something went wrong.";
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
      }).format(date);
}

function formatBytes(value: number | null) {
  if (value === null) {
    return null;
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function getWorkspaceTitle(audio: LibraryAudio) {
  const title = getLibraryAudioTitle(audio);

  if (audio.origin === "EXTERNAL" && audio.url && title === audio.url) {
    return "External audio";
  }

  return title;
}

export function AudioLibraryPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const { audioId } = useParams();

  const parsedRouteAudioId = audioId === undefined ? null : Number(audioId);

  const validRouteAudioId =
    parsedRouteAudioId !== null &&
    Number.isSafeInteger(parsedRouteAudioId) &&
    parsedRouteAudioId > 0
      ? parsedRouteAudioId
      : null;

  const hasInvalidRouteAudioId =
    audioId !== undefined && validRouteAudioId === null;

  const workspaceScrollRef = useRef<HTMLElement | null>(null);

  const audioStageRef = useRef<HTMLElement | null>(null);

  const addPanelTriggerRef = useRef<HTMLButtonElement | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const playerRef = useRef<HTMLAudioElement | null>(null);

  const [items, setItems] = useState<LibraryAudio[]>([]);

  const [activeAudio, setActiveAudio] = useState<LibraryAudio | null>(null);

  const [loadingAudioId, setLoadingAudioId] = useState<number | null>(
    validRouteAudioId,
  );

  const [activeLoadError, setActiveLoadError] = useState<AudioLoadError | null>(
    null,
  );

  const [activeReloadKey, setActiveReloadKey] = useState(0);

  const [reliablePosition, setReliablePosition] = useState<number | null>(null);

  const [page, setPage] = useState(0);

  const [totalPages, setTotalPages] = useState(0);

  const [totalElements, setTotalElements] = useState(0);

  const [url, setUrl] = useState("");

  const [title, setTitle] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [isAdding, setIsAdding] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  const [removingAudio, setRemovingAudio] = useState<LibraryAudio | null>(null);

  const [isRemoving, setIsRemoving] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);

  const clearActiveContext = useContextStore(
    (state) => state.clearActiveContext,
  );

  const setActiveContext = useContextStore((state) => state.setActiveContext);

  const loadAudio = useCallback(async (targetPage: number) => {
    await Promise.resolve();

    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await getAudioLibrary({
        page: targetPage,
        size: PAGE_SIZE,
      });

      if (
        targetPage > 0 &&
        response.totalPages > 0 &&
        targetPage >= response.totalPages
      ) {
        setPage(response.totalPages - 1);

        return;
      }

      setItems(response.items);

      setTotalPages(response.totalPages);

      setTotalElements(response.totalElements);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAudio(page), 0);

    return () => window.clearTimeout(timer);
  }, [loadAudio, page]);

  /*
   * Keep /audio and /audio/:audioId in one page.
   *
   * The route selects the active Audio source while the
   * Library remains visible below it.
   *
   * State updates are deferred to avoid synchronous
   * setState calls directly inside the Effect body.
   */
  useEffect(() => {
    let cancelled = false;

    const routeTimer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      if (audioId === undefined) {
        setActiveAudio(null);
        setLoadingAudioId(null);
        setActiveLoadError(null);
        setReliablePosition(null);

        const current = useContextStore.getState().activeContext;

        if (current?.entityType === "audio") {
          clearActiveContext();
        }

        return;
      }

      if (validRouteAudioId === null) {
        return;
      }

      const current = useContextStore.getState().activeContext;

      if (
        current?.entityType === "audio" &&
        current.entityId !== String(validRouteAudioId)
      ) {
        clearActiveContext();
      }

      setActiveAudio(null);

      setActiveLoadError(null);

      setReliablePosition(null);

      setLoadingAudioId(validRouteAudioId);

      void getLibraryAudio(validRouteAudioId)
        .then((nextAudio) => {
          if (cancelled) {
            return;
          }

          const workspaceTitle = getWorkspaceTitle(nextAudio);

          setActiveAudio(nextAudio);

          setActiveContext({
            entityId: String(nextAudio.id),
            entityType: "audio",
            title: workspaceTitle,
          });
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          setActiveLoadError({
            audioId: validRouteAudioId,
            message: getErrorMessage(error),
          });
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingAudioId(null);
          }
        });
    }, 0);

    return () => {
      cancelled = true;

      window.clearTimeout(routeTimer);
    };
  }, [
    audioId,
    validRouteAudioId,
    activeReloadKey,
    clearActiveContext,
    setActiveContext,
  ]);

  /*
   * Do not leak an Audio context after leaving the
   * Audio workspace entirely.
   */
  useEffect(
    () => () => {
      const current = useContextStore.getState().activeContext;

      if (current?.entityType === "audio") {
        useContextStore.getState().clearActiveContext();
      }
    },
    [],
  );

  useEffect(() => {
    workspaceScrollRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [audioId]);

  if (hasInvalidRouteAudioId) {
    return <Navigate to="/audio" replace />;
  }

  function closeAddPanelAndRestoreFocus() {
    setIsAddPanelOpen(false);

    window.requestAnimationFrame(() => {
      addPanelTriggerRef.current?.focus();
    });
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextUrl = url.trim();

    if (!nextUrl || isAdding) {
      return;
    }

    setIsAdding(true);
    setActionError(null);

    try {
      await addAudioUrl({
        url: nextUrl,
        title: title.trim() || null,
      });

      setUrl("");
      setTitle("");
      closeAddPanelAndRestoreFocus();

      if (page === 0) {
        await loadAudio(0);
      } else {
        setPage(0);
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setActionError(null);

    try {
      await uploadAudio(file);

      closeAddPanelAndRestoreFocus();

      if (page === 0) {
        await loadAudio(0);
      } else {
        setPage(0);
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setIsUploading(false);

      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  }

  async function handleRemove() {
    if (!removingAudio || isRemoving) {
      return;
    }

    const audioToRemove = removingAudio;

    setIsRemoving(true);
    setActionError(null);

    try {
      await removeLibraryAudio(audioToRemove.id);

      setRemovingAudio(null);

      const removedActiveAudio = validRouteAudioId === audioToRemove.id;

      if (removedActiveAudio) {
        setActiveAudio(null);

        setReliablePosition(null);

        const current = useContextStore.getState().activeContext;

        if (
          current?.entityType === "audio" &&
          current.entityId === String(audioToRemove.id)
        ) {
          clearActiveContext();
        }

        navigate("/audio", {
          replace: true,
        });

        focusAudioStage();
      }

      const nextPage = items.length === 1 && page > 0 ? page - 1 : page;

      if (nextPage === page) {
        await loadAudio(nextPage);
      } else {
        setPage(nextPage);
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setIsRemoving(false);
    }
  }

  function handleOpenAudio(audio: LibraryAudio) {
    navigate(`/audio/${audio.id}`);
    focusAudioStage();
  }

  function handleCloseActiveAudio() {
    navigate("/audio");
    focusAudioStage();
  }

  function focusAudioStage() {
    window.requestAnimationFrame(() => {
      audioStageRef.current?.focus();
    });
  }

  function handleReliablePosition(seconds: number) {
    setReliablePosition(seconds);

    if (validRouteAudioId === null) {
      return;
    }

    const context = useContextStore.getState().activeContext;

    if (
      context?.entityType === "audio" &&
      context.entityId === String(validRouteAudioId)
    ) {
      useContextStore.getState().setTimestamp(seconds);
    }
  }

  const navigationState = location.state as {
    audioWorkspaceRestore?: {
      libraryAudioId: number;
      noteId: number;
      timestampSeconds: number | null;
    };
  } | null;

  const restoreRequest =
    validRouteAudioId !== null &&
    navigationState?.audioWorkspaceRestore?.libraryAudioId === validRouteAudioId
      ? navigationState.audioWorkspaceRestore
      : null;

  const activeTitle = activeAudio ? getWorkspaceTitle(activeAudio) : "Audio";

  const playbackUrl = activeAudio
    ? getAudioPlaybackUrl(
        activeAudio.sourceId,
        activeAudio.origin,
        activeAudio.url,
      )
    : "";

  const sourceLabel =
    activeAudio?.origin === "UPLOAD" ? "Uploaded file" : "External URL";

  const sourceValue =
    activeAudio?.origin === "UPLOAD"
      ? activeAudio.originalFilename
      : activeAudio?.url;

  const routeLoadError =
    validRouteAudioId !== null && activeLoadError?.audioId === validRouteAudioId
      ? activeLoadError.message
      : null;

  const activeAudioReady =
    validRouteAudioId !== null && activeAudio?.id === validRouteAudioId;

  const activeAudioPending =
    validRouteAudioId !== null && !activeAudioReady && routeLoadError === null;

  return (
    <main
      ref={workspaceScrollRef}
      className="no-scrollbar min-w-0 flex-1 overflow-y-auto p-4 sm:p-6"
    >
      <div className="mx-auto max-w-7xl">
        {/* Audio stage */}
        <section
          ref={audioStageRef}
          tabIndex={-1}
          aria-label="Audio workspace"
          className="rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
        >
          {audioId === undefined ? (
            <div className="flex min-h-56 items-center justify-center rounded-3xl border border-(--border) bg-(--surface) p-6">
              <div className="max-w-lg text-center">
                <Headphones
                  className="mx-auto mb-4 text-(--text-muted)"
                  size={56}
                  aria-hidden="true"
                />

                <h3 className="text-lg font-semibold sm:text-xl">
                  No audio open
                </h3>

                <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
                  Choose an audio source from your Library to start listening
                  and taking notes.
                </p>

                {items[0] && (
                  <button
                    type="button"
                    onClick={() => handleOpenAudio(items[0])}
                    className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                  >
                    <Headphones size={16} aria-hidden="true" />
                    Open first audio
                  </button>
                )}
              </div>
            </div>
          ) : activeAudioPending || loadingAudioId === validRouteAudioId ? (
            <div
              role="status"
              className="flex min-h-56 items-center justify-center rounded-3xl border border-(--border) bg-(--surface) p-6"
            >
              <div className="max-w-lg text-center">
                <LoaderCircle
                  className="mx-auto mb-4 animate-spin text-(--text-muted)"
                  size={42}
                  aria-hidden="true"
                />

                <h3 className="text-lg font-semibold sm:text-xl">
                  Opening audio
                </h3>

                <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
                  Loading the saved audio context.
                </p>
              </div>
            </div>
          ) : routeLoadError ? (
            <div className="flex min-h-56 items-center justify-center rounded-3xl border border-(--border) bg-(--surface) p-6">
              <div className="max-w-lg text-center">
                <Headphones
                  className="mx-auto mb-4 text-(--text-muted)"
                  size={56}
                  aria-hidden="true"
                />

                <h3 className="text-lg font-semibold sm:text-xl">
                  Could not open audio
                </h3>

                <p
                  role="alert"
                  className="mt-2 text-sm leading-6 text-(--text-secondary)"
                >
                  {routeLoadError}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReloadKey((value) => value + 1);
                      focusAudioStage();
                    }}
                    className="rounded-xl bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                  >
                    Try again
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseActiveAudio}
                    className="rounded-xl px-4 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                  >
                    Close audio
                  </button>
                </div>
              </div>
            </div>
          ) : activeAudioReady && activeAudio ? (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h3
                    className="wrap-break-word text-lg font-semibold sm:text-xl"
                    title={activeTitle}
                  >
                    {activeTitle}
                  </h3>

                  <div className="mt-1 min-w-0 text-sm text-(--text-muted)">
                    {activeAudio.origin === "UPLOAD"
                      ? "Uploaded audio"
                      : "External audio"}
                  </div>
                </div>

                <div className="flex w-full items-center justify-end gap-1 sm:w-auto sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setRemovingAudio(activeAudio);
                    }}
                    aria-label="Remove active audio from Library"
                    title="Remove from Library"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border) text-xs font-medium text-(--text-secondary) transition hover:border-(--danger-border) hover:bg-(--danger-surface) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5"
                  >
                    <Trash2 size={14} aria-hidden="true" />

                    <span className="hidden sm:inline">Remove</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseActiveAudio}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) xl:h-8"
                  >
                    <X size={14} aria-hidden="true" />
                    Close audio
                  </button>
                </div>
              </div>

              <div className="mx-auto w-full min-w-0 max-w-5xl">
                <div className="min-w-0 rounded-3xl border border-(--border) bg-(--surface) p-2 sm:p-5">
                  <div className="min-w-0">
                    <AudioPlayer
                      key={activeAudio.id}
                      url={playbackUrl}
                      title={activeTitle}
                      playerRef={playerRef}
                      seekToSeconds={restoreRequest?.timestampSeconds ?? null}
                      seekRequestKey={
                        restoreRequest
                          ? `${restoreRequest.noteId}:${location.key}`
                          : "ordinary-navigation"
                      }
                      onReliablePosition={handleReliablePosition}
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-(--border) bg-(--surface) p-3">
                  <dl className="grid min-w-0 gap-x-5 gap-y-3 sm:grid-cols-2">
                    <div className="min-w-0">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                        Source type
                      </dt>

                      <dd className="mt-1 text-sm text-(--text-secondary)">
                        {activeAudio.origin === "UPLOAD"
                          ? "Uploaded audio"
                          : "External audio"}
                      </dd>
                    </div>

                    <div className="min-w-0">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                        Note timestamp
                      </dt>

                      <dd className="mt-1 text-sm tabular-nums text-(--text-secondary)">
                        {reliablePosition !== null
                          ? formatTime(reliablePosition)
                          : "Not established yet"}
                      </dd>
                    </div>

                    <div className="min-w-0 sm:col-span-2">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                        {sourceLabel}
                      </dt>

                      <dd
                        title={sourceValue ?? undefined}
                        className="mt-1 max-h-20 overflow-y-auto break-all font-mono text-xs leading-5 text-(--text-secondary)"
                      >
                        {sourceValue || "Unavailable"}
                      </dd>
                    </div>
                  </dl>

                  <p className="mt-3 border-t border-(--border) pt-3 text-xs leading-5 text-(--text-muted)">
                    {reliablePosition !== null
                      ? `Current reliable position: ${formatTime(
                          reliablePosition,
                        )}. New timestamped Notes can use this exact position.`
                      : "Play or load the audio to establish a reliable timestamp before capturing a timestamped Note."}
                  </p>
                </div>
              </div>
            </>
          ) : null}
        </section>

        {/* Same context summary row as Video/Image */}
        <div className="mt-4">
          <ContextSummary />
        </div>

        {/* Library */}
        <section
          aria-busy={isLoading || isAdding || isUploading || isRemoving}
          className="mt-4 w-full rounded-xl border border-(--border) bg-(--surface) p-4 sm:p-5"
        >
          <LibraryMediaNavigation className="mb-4" />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-(--text-primary)">
                Library
              </h2>

              <p className="mt-1 text-sm text-(--text-muted)">
                Your saved audio study sources.
              </p>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
              <span className="rounded-full bg-(--surface-hover) px-2.5 py-1 text-xs text-(--text-secondary)">
                {totalElements} audio
                {totalElements === 1 ? " item" : " items"}
              </span>

              <button
                ref={addPanelTriggerRef}
                type="button"
                onClick={() => {
                  setActionError(null);

                  setIsAddPanelOpen((open) => !open);
                }}
                aria-expanded={isAddPanelOpen}
                aria-controls="library-add-audio-panel"
                aria-label={isAddPanelOpen ? "Close add audio" : "Add audio"}
                title={isAddPanelOpen ? "Close" : "Add audio"}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-(--border) px-2.5 text-xs font-medium text-(--text-secondary) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) sm:h-8"
              >
                {isAddPanelOpen ? (
                  <X size={14} aria-hidden="true" />
                ) : (
                  <Plus size={14} aria-hidden="true" />
                )}

                <span className="hidden sm:inline">
                  {isAddPanelOpen ? "Close" : "Add"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void loadAudio(page)}
                disabled={isLoading}
                aria-label="Refresh audio library"
                title="Refresh audio library"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
              >
                <RefreshCw
                  size={14}
                  className={isLoading ? "animate-spin" : undefined}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>

          {isAddPanelOpen && (
            <div
              id="library-add-audio-panel"
              className="mb-3 rounded-xl border border-(--border) bg-(--app-bg) p-3"
            >
              <div className="mb-3">
                <h3 className="text-sm font-medium text-(--text-primary)">
                  Add audio
                </h3>

                <p className="mt-1 text-xs text-(--text-muted)">
                  Paste a direct HTTP(S) audio URL below, or upload an MP3 file
                  from your device.
                </p>
              </div>

              <form
                onSubmit={handleAdd}
                className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.4fr)_auto]"
              >
                <label htmlFor="audio-url" className="sr-only">
                  Direct audio URL
                </label>

                <input
                  id="audio-url"
                  type="url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      closeAddPanelAndRestoreFocus();
                    }
                  }}
                  disabled={isAdding || isUploading}
                  autoFocus
                  placeholder="https://example.com/audio.mp3"
                  className="min-w-0 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
                />

                <label htmlFor="audio-title" className="sr-only">
                  Optional title
                </label>

                <input
                  id="audio-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  disabled={isAdding || isUploading}
                  placeholder="Optional title"
                  maxLength={255}
                  className="min-w-0 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={!url.trim() || isAdding || isUploading}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-(--primary-bg) px-3 text-xs font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
                >
                  {isAdding ? (
                    <LoaderCircle
                      size={14}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Plus size={14} aria-hidden="true" />
                  )}
                  Add audio
                </button>
              </form>

              <div className="mt-3 border-t border-(--border) pt-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-(--text-secondary)">
                      Upload from device
                    </p>

                    <p className="mt-1 text-xs text-(--text-muted)">
                      Add a local MP3 file to your Audio Library.
                    </p>
                  </div>

                  <div className="shrink-0">
                    <input
                      ref={uploadInputRef}
                      id="audio-upload"
                      type="file"
                      accept="audio/mpeg,.mp3"
                      disabled={isAdding || isUploading}
                      onChange={(event) =>
                        void handleUpload(event.target.files?.[0])
                      }
                      className="sr-only"
                    />

                    <label
                      htmlFor="audio-upload"
                      aria-disabled={isAdding || isUploading}
                      className={`inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-(--border) px-3 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-within:ring-2 focus-within:ring-(--focus) sm:min-h-9 sm:w-auto ${
                        isAdding || isUploading
                          ? "pointer-events-none opacity-50"
                          : ""
                      }`}
                    >
                      {isUploading ? (
                        <LoaderCircle
                          size={14}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <Upload size={14} aria-hidden="true" />
                      )}

                      {isUploading ? "Uploading..." : "Upload MP3"}
                    </label>
                  </div>
                </div>
              </div>

              {actionError && (
                <p role="alert" className="mt-3 text-sm text-(--danger-text)">
                  {actionError}
                </p>
              )}
            </div>
          )}

          {isLoading && items.length === 0 ? (
            <div
              role="status"
              className="flex min-h-48 items-center justify-center"
            >
              <p className="text-sm text-(--text-muted)">Loading library...</p>
            </div>
          ) : loadError ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) px-4 py-3"
            >
              <p className="text-sm text-(--danger-text)">{loadError}</p>

              <button
                type="button"
                onClick={() => void loadAudio(page)}
                className="mt-3 rounded-lg border border-(--danger-border) px-3 py-2 text-xs text-(--danger-text) transition hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div
              role="status"
              className="mt-4 rounded-2xl border border-dashed border-(--border) bg-(--app-bg) p-8 text-center"
            >
              <p className="text-sm font-medium text-(--text-secondary)">
                Your Audio Library is empty
              </p>

              <p className="mt-1 text-sm text-(--text-muted)">
                Add your first audio source by URL or upload an MP3 file.
              </p>

              <button
                type="button"
                onClick={() => setIsAddPanelOpen(true)}
                className="mt-4 rounded-lg bg-(--primary-bg) px-3 py-2 text-xs font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
              >
                Add your first audio
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {items.map((audio) => {
                const displayTitle = getLibraryAudioTitle(audio);

                const size = formatBytes(audio.sizeBytes);

                const isActive = validRouteAudioId === audio.id;

                const sourceText =
                  audio.origin === "UPLOAD"
                    ? audio.originalFilename || "Uploaded MP3"
                    : audio.url || "External audio";

                return (
                  <article
                    key={audio.id}
                    className={`min-w-0 overflow-visible rounded-xl border transition ${
                      isActive
                        ? "border-(--border-strong) bg-(--surface-hover)"
                        : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenAudio(audio)}
                      aria-current={isActive ? "true" : undefined}
                      aria-label={`Open audio ${displayTitle}`}
                      className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--focus)"
                    >
                      <div className="relative flex aspect-video items-center justify-center overflow-hidden bg-(--surface)">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-(--surface-hover) text-(--text-muted)">
                          <Headphones size={30} aria-hidden="true" />
                        </div>

                        {isActive && (
                          <span className="absolute left-2 top-2 rounded-full bg-(--surface) px-2 py-1 text-[11px] font-medium text-(--text-primary) shadow-sm">
                            Active
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="min-w-0 p-3.5">
                      <button
                        type="button"
                        onClick={() => handleOpenAudio(audio)}
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
                        <span className="min-w-0 truncate" title={sourceText}>
                          {audio.origin === "UPLOAD"
                            ? "Uploaded MP3"
                            : "External audio"}
                        </span>

                        {size && (
                          <>
                            <span aria-hidden="true">·</span>

                            <span className="shrink-0">{size}</span>
                          </>
                        )}
                      </div>

                      <p
                        className="mt-1 truncate text-xs text-(--text-secondary)"
                        title={sourceText}
                      >
                        {sourceText}
                      </p>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[11px] text-(--text-muted)">
                          Added {formatDate(audio.addedAt)}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);

                            setRemovingAudio(audio);
                          }}
                          aria-label={`Remove ${displayTitle} from Library`}
                          title="Remove from Library"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(--danger-surface) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) sm:h-7 sm:w-7"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <LibraryPagination
            page={page}
            totalPages={totalPages}
            isLoading={isLoading}
            onChangePage={async (nextPage) => setPage(nextPage)}
          />
        </section>
      </div>

      <ConfirmDialog
        open={removingAudio !== null}
        title="Remove this audio from Library?"
        description="This removes only the Library entry. Existing Notes and Tasks keep their exact audio source context."
        confirmLabel="Remove from Library"
        isBusy={isRemoving}
        errorMessage={actionError}
        onCancel={() => {
          if (!isRemoving) {
            setRemovingAudio(null);

            setActionError(null);
          }
        }}
        onConfirm={handleRemove}
      />
    </main>
  );
}
