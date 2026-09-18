import {
  Headphones,
  LoaderCircle,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ApiError } from "../../../lib/api";
import { LibraryPagination } from "../../media/components/LibraryPagination";
import { LibraryMediaNavigation } from "../../media/components/LibraryMediaNavigation";
import {
  addAudioUrl,
  getAudioLibrary,
  getLibraryAudioTitle,
  removeLibraryAudio,
  uploadAudio,
  type LibraryAudio,
} from "../services/audioApi";

const PAGE_SIZE = 12;

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

function formatBytes(value: number | null) {
  if (value === null) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function AudioLibraryPage() {
  const navigate = useNavigate();
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<LibraryAudio[]>([]);
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

  const loadAudio = useCallback(async (targetPage: number) => {
    await Promise.resolve();
    setIsLoading(true);
    setLoadError(null);

    try {
      const response = await getAudioLibrary({ page: targetPage, size: PAGE_SIZE });

      if (targetPage > 0 && response.totalPages > 0 && targetPage >= response.totalPages) {
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

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextUrl = url.trim();
    if (!nextUrl || isAdding) return;

    setIsAdding(true);
    setActionError(null);

    try {
      await addAudioUrl({ url: nextUrl, title: title.trim() || null });
      setUrl("");
      setTitle("");
      if (page === 0) await loadAudio(0);
      else setPage(0);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setIsAdding(false);
    }
  }

  async function handleRemove() {
    if (!removingAudio || isRemoving) return;
    setIsRemoving(true);
    setActionError(null);

    try {
      await removeLibraryAudio(removingAudio.id);
      setRemovingAudio(null);
      const nextPage = items.length === 1 && page > 0 ? page - 1 : page;
      if (nextPage === page) await loadAudio(nextPage);
      else setPage(nextPage);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setIsRemoving(false);
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file || isUploading) return;

    setIsUploading(true);
    setActionError(null);

    try {
      await uploadAudio(file);
      if (page === 0) await loadAudio(0);
      else setPage(0);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setIsUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <LibraryMediaNavigation className="mb-5" />

        <header className="border-b border-(--border) pb-5">
          <h1 className="text-2xl font-semibold">Audio</h1>
          <p className="mt-1 text-sm text-(--text-muted)">
            Keep exact direct audio sources and capture timestamped notes.
          </p>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <form onSubmit={handleAdd} className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(200px,0.4fr)_auto]">
            <label htmlFor="audio-url" className="sr-only">Direct audio URL</label>
            <input
              id="audio-url"
              type="url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              disabled={isAdding || isUploading}
              placeholder="https://example.com/audio.mp3"
              className="min-w-0 rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
            />
            <label htmlFor="audio-title" className="sr-only">Optional title</label>
            <input
              id="audio-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              disabled={isAdding || isUploading}
              placeholder="Optional title"
              maxLength={255}
              className="min-w-0 rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!url.trim() || isAdding || isUploading}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-(--primary-bg) px-4 text-sm font-medium text-(--primary-text) hover:bg-(--primary-hover) disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isAdding ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
              Add audio
            </button>
          </form>

          <div>
            <input
              ref={uploadInputRef}
              id="audio-upload"
              type="file"
              accept="audio/mpeg,.mp3"
              disabled={isAdding || isUploading}
              onChange={(event) => void handleUpload(event.target.files?.[0])}
              className="sr-only"
            />
            <label
              htmlFor="audio-upload"
              aria-disabled={isAdding || isUploading}
              className={`inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-(--border) px-4 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-within:ring-2 focus-within:ring-(--focus) ${
                isAdding || isUploading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {isUploading ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Upload size={15} aria-hidden="true" />}
              {isUploading ? "Uploading..." : "Upload MP3"}
            </label>
          </div>
          </div>

          {actionError && <p role="alert" className="mt-3 text-sm text-(--danger-text)">{actionError}</p>}
        </header>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-(--text-muted)">{totalElements} audio item{totalElements === 1 ? "" : "s"}</p>
          <button type="button" onClick={() => void loadAudio(page)} disabled={isLoading} className="text-xs text-(--text-secondary) hover:text-(--text-primary) disabled:opacity-50">Refresh</button>
        </div>

        {isLoading && items.length === 0 ? (
          <div role="status" className="flex min-h-72 items-center justify-center gap-2 text-sm text-(--text-muted)">
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" /> Loading audio...
          </div>
        ) : loadError ? (
          <div className="mt-5 rounded-2xl border border-(--danger-border) bg-(--danger-surface) p-5">
            <p role="alert" className="text-sm text-(--danger-text)">{loadError}</p>
            <button type="button" onClick={() => void loadAudio(page)} className="mt-3 rounded-lg border border-(--danger-border) px-3 py-2 text-xs text-(--danger-text)">Try again</button>
          </div>
        ) : items.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-(--border) p-10 text-center">
            <Headphones size={30} className="mx-auto text-(--text-muted)" aria-hidden="true" />
            <h2 className="mt-3 text-sm font-medium">No audio yet</h2>
            <p className="mt-1 text-sm text-(--text-muted)">Add a direct HTTP(S) audio URL or upload an MP3 file.</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((audio) => {
              const displayTitle = getLibraryAudioTitle(audio);
              const size = formatBytes(audio.sizeBytes);
              return (
                <article key={audio.id} className="min-w-0 rounded-2xl border border-(--border) bg-(--surface) p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--surface-hover) text-(--text-muted)"><Headphones size={18} aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={displayTitle}>{displayTitle}</p>
                      <p className="mt-1 truncate text-xs text-(--text-muted)" title={audio.url ?? audio.originalFilename ?? undefined}>
                        {audio.origin === "UPLOAD" ? "Uploaded MP3" : audio.url}
                        {size ? ` · ${size}` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-(--text-muted)">Added {formatDate(audio.addedAt)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button type="button" onClick={() => navigate(`/audio/${audio.id}`)} className="flex-1 rounded-lg border border-(--border) px-3 py-2 text-xs text-(--text-secondary) hover:bg-(--surface-hover)">Open</button>
                    <button type="button" onClick={() => { setActionError(null); setRemovingAudio(audio); }} aria-label={`Remove ${displayTitle} from Library`} className="flex h-9 w-9 items-center justify-center rounded-lg text-(--text-muted) hover:bg-(--danger-surface) hover:text-(--danger-text)"><Trash2 size={14} aria-hidden="true" /></button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <LibraryPagination page={page} totalPages={totalPages} isLoading={isLoading} onChangePage={async (nextPage) => setPage(nextPage)} />
      </div>

      <ConfirmDialog
        open={removingAudio !== null}
        title="Remove this audio from Library?"
        description="This removes only the Library entry. Existing Notes and Tasks keep their exact audio source context."
        confirmLabel="Remove from Library"
        isBusy={isRemoving}
        errorMessage={actionError}
        onCancel={() => { if (!isRemoving) { setRemovingAudio(null); setActionError(null); } }}
        onConfirm={handleRemove}
      />
    </main>
  );
}
