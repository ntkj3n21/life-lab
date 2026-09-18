import { ArrowLeft, LoaderCircle, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ApiError } from "../../../lib/api";
import { useContextStore } from "../../../stores/contextStore";
import { ImagePreview } from "../components/ImagePreview";
import {
  getLibraryImage,
  getLibraryImageTitle,
  removeLibraryImage,
  type LibraryImage,
} from "../services/imageApi";

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
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function ImageWorkspacePage() {
  const navigate = useNavigate();
  const { imageId } = useParams();
  const parsedImageId = Number(imageId);
  const validImageId = Number.isSafeInteger(parsedImageId) && parsedImageId > 0;
  const [image, setImage] = useState<LibraryImage | null>(null);
  const [isLoading, setIsLoading] = useState(validImageId);
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
      if (current?.entityType === "image" && current.entityId === String(parsedImageId)) {
        useContextStore.getState().clearActiveContext();
      }
    };
  }, [clearActiveContext, parsedImageId]);

  const loadWorkspace = useCallback(async () => {
    if (!validImageId) return;
    await Promise.resolve();
    setIsLoading(true);
    setLoadError(null);

    try {
      const nextImage = await getLibraryImage(parsedImageId);
      const title = getLibraryImageTitle(nextImage);
      setImage(nextImage);
      setActiveContext({
        entityId: String(nextImage.id),
        entityType: "image",
        title,
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [parsedImageId, setActiveContext, validImageId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadWorkspace(), 0);
    return () => window.clearTimeout(timer);
  }, [loadWorkspace]);

  if (!validImageId) return <Navigate to="/images" replace />;

  async function handleRemove() {
    if (isRemoving) return;
    setIsRemoving(true);
    setActionError(null);
    try {
      await removeLibraryImage(parsedImageId);
      navigate("/images", { replace: true });
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setIsRemoving(false);
    }
  }

  const title = image ? getLibraryImageTitle(image) : "Image";

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => navigate("/images")} className="inline-flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary)">
            <ArrowLeft size={15} aria-hidden="true" /> Back to Images
          </button>
          {image && (
            <button type="button" onClick={() => { setActionError(null); setConfirmRemove(true); }} className="inline-flex items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-muted) transition hover:bg-(--danger-surface) hover:text-(--danger-text)">
              <Trash2 size={14} aria-hidden="true" /> Remove from Library
            </button>
          )}
        </div>

        {isLoading ? (
          <div role="status" className="flex min-h-72 items-center justify-center gap-2 text-sm text-(--text-muted)"><LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Loading image workspace...</div>
        ) : loadError ? (
          <div className="mt-5 rounded-2xl border border-(--danger-border) bg-(--danger-surface) p-5">
            <p role="alert" className="text-sm text-(--danger-text)">{loadError}</p>
            <button type="button" onClick={() => void loadWorkspace()} className="mt-3 rounded-lg border border-(--danger-border) px-3 py-2 text-xs text-(--danger-text)">Try again</button>
          </div>
        ) : image ? (
          <>
            <header className="mt-5 min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">Image workspace</p>
              <h1 className="mt-2 wrap-break-word text-xl font-semibold sm:text-2xl">{title}</h1>
            </header>
            {actionError && <p role="alert" className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) p-3 text-sm text-(--danger-text)">{actionError}</p>}
            <section className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
              <div className="flex min-h-[320px] items-center justify-center bg-(--app-bg) sm:min-h-[460px]">
                <ImagePreview sourceId={image.sourceId} origin={image.origin} url={image.url} alt={title} className="max-h-[70vh] w-full object-contain" />
              </div>
              <dl className="grid gap-3 border-t border-(--border) p-4 text-xs text-(--text-muted) sm:grid-cols-2">
                <div><dt>Source</dt><dd className="mt-1 text-(--text-secondary)">{image.origin === "UPLOAD" ? "Uploaded file" : "External URL"}</dd></div>
                <div><dt>Added</dt><dd className="mt-1 text-(--text-secondary)">{formatDate(image.addedAt)}</dd></div>
                {image.mediaType && <div><dt>Media type</dt><dd className="mt-1 text-(--text-secondary)">{image.mediaType}</dd></div>}
                {image.origin === "EXTERNAL" && image.url && <div className="min-w-0"><dt>Exact URL</dt><dd className="mt-1 truncate text-(--text-secondary)" title={image.url}>{image.url}</dd></div>}
              </dl>
            </section>
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove this image from Library?"
        description="This removes only the Library entry. Existing Notes and Tasks keep the exact image source for Source Preview."
        confirmLabel="Remove from Library"
        isBusy={isRemoving}
        errorMessage={actionError}
        onCancel={() => { if (!isRemoving) { setConfirmRemove(false); setActionError(null); } }}
        onConfirm={handleRemove}
      />
    </main>
  );
}
