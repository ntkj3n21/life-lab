import { ArrowLeft, LoaderCircle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useLocation, useNavigate, useParams } from "react-router-dom";

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
    const details = Object.values(error.fieldErrors).filter(Boolean);
    return details.length > 0 ? details.join(" ") : error.message;
  }
  return "Something went wrong.";
}

export function AudioWorkspacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { audioId } = useParams();
  const parsedAudioId = Number(audioId);
  const validAudioId = Number.isSafeInteger(parsedAudioId) && parsedAudioId > 0;
  const playerRef = useRef<HTMLAudioElement | null>(null);
  const [audio, setAudio] = useState<LibraryAudio | null>(null);
  const [reliablePosition, setReliablePosition] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(validAudioId);
  const [isRemoving, setIsRemoving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const clearActiveContext = useContextStore((state) => state.clearActiveContext);
  const setActiveContext = useContextStore((state) => state.setActiveContext);

  useEffect(() => {
    clearActiveContext();
    return () => {
      const current = useContextStore.getState().activeContext;
      if (current?.entityType === "audio" && current.entityId === String(parsedAudioId)) {
        useContextStore.getState().clearActiveContext();
      }
    };
  }, [clearActiveContext, parsedAudioId]);

  const loadWorkspace = useCallback(async () => {
    if (!validAudioId) return;
    await Promise.resolve();
    setReliablePosition(null);
    setIsLoading(true);
    setLoadError(null);

    try {
      const nextAudio = await getLibraryAudio(parsedAudioId);
      const title = getLibraryAudioTitle(nextAudio);
      setAudio(nextAudio);
      setActiveContext({
        entityId: String(nextAudio.id),
        entityType: "audio",
        title,
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [parsedAudioId, setActiveContext, validAudioId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  if (!validAudioId) return <Navigate to="/audio" replace />;

  async function handleRemove() {
    if (isRemoving) return;
    setIsRemoving(true);
    setActionError(null);
    try {
      await removeLibraryAudio(parsedAudioId);
      navigate("/audio", { replace: true });
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setIsRemoving(false);
    }
  }

  function handleReliablePosition(seconds: number) {
    setReliablePosition(seconds);
    const context = useContextStore.getState().activeContext;
    if (context?.entityType === "audio" && context.entityId === String(parsedAudioId)) {
      useContextStore.getState().setTimestamp(seconds);
    }
  }

  const displayTitle = audio ? getLibraryAudioTitle(audio) : "Audio";
  const playbackUrl = audio
    ? getAudioPlaybackUrl(audio.sourceId, audio.origin, audio.url)
    : "";
  const navigationState = location.state as {
    audioWorkspaceRestore?: {
      libraryAudioId: number;
      noteId: number;
      timestampSeconds: number | null;
    };
  } | null;
  const restoreRequest =
    navigationState?.audioWorkspaceRestore?.libraryAudioId === parsedAudioId
      ? navigationState.audioWorkspaceRestore
      : null;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => navigate("/audio")} className="inline-flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) hover:bg-(--surface)">
            <ArrowLeft size={15} aria-hidden="true" /> Back to Audio
          </button>
          {audio && (
            <button type="button" onClick={() => { setActionError(null); setConfirmRemove(true); }} className="inline-flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-muted) hover:bg-(--danger-surface) hover:text-(--danger-text)">
              <Trash2 size={14} aria-hidden="true" /> Remove from Library
            </button>
          )}
        </div>

        {isLoading ? (
          <div role="status" className="flex min-h-72 items-center justify-center gap-2 text-sm text-(--text-muted)"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Loading audio workspace...</div>
        ) : loadError ? (
          <div className="mt-5 rounded-2xl border border-(--danger-border) bg-(--danger-surface) p-5">
            <p role="alert" className="text-sm text-(--danger-text)">{loadError}</p>
            <button type="button" onClick={() => void loadWorkspace()} className="mt-3 rounded-lg border border-(--danger-border) px-3 py-2 text-xs text-(--danger-text)">Try again</button>
          </div>
        ) : audio ? (
          <>
            <header className="mt-5 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">Audio workspace</p>
              <h1 className="mt-2 wrap-break-word text-xl font-semibold sm:text-2xl">{displayTitle}</h1>
            </header>
            {actionError && <p role="alert" className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) p-3 text-sm text-(--danger-text)">{actionError}</p>}
            <section className="mt-5 min-w-0 rounded-2xl border border-(--border) bg-(--surface) p-4 sm:p-5">
              <AudioPlayer
                url={playbackUrl}
                title={displayTitle}
                playerRef={playerRef}
                seekToSeconds={restoreRequest?.timestampSeconds ?? null}
                seekRequestKey={restoreRequest ? `${restoreRequest.noteId}:${location.key}` : "ordinary-navigation"}
                onReliablePosition={handleReliablePosition}
              />
              <div className="mt-4 rounded-xl border border-(--border) bg-(--app-bg) p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">{audio.origin === "UPLOAD" ? "Uploaded file" : "Exact source URL"}</p>
                <p className="mt-1 break-all text-xs leading-5 text-(--text-secondary)">{audio.origin === "UPLOAD" ? audio.originalFilename : audio.url}</p>
              </div>
              <p className="mt-3 text-xs text-(--text-muted)">
                {reliablePosition !== null ? `Current note timestamp: ${formatTime(reliablePosition)}` : "Play or load the audio to establish a reliable timestamp."}
              </p>
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
        onCancel={() => { if (!isRemoving) { setConfirmRemove(false); setActionError(null); } }}
        onConfirm={handleRemove}
      />
    </main>
  );
}
