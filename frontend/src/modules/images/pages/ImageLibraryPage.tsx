import {
  ExternalLink,
  ImagePlus,
  LoaderCircle,
  Search,
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
import { ImagePreview } from "../components/ImagePreview";
import { LibraryPagination } from "../../media/components/LibraryPagination";
import { LibraryMediaNavigation } from "../../media/components/LibraryMediaNavigation";
import {
  addExternalImage,
  getImageLibrary,
  getLibraryImageTitle,
  removeLibraryImage,
  uploadImage,
  type LibraryImage,
} from "../services/imageApi";

const PAGE_SIZE = 12;

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

export function ImageLibraryPage() {
  const navigate = useNavigate();
  const uploadInputRef =
    useRef<HTMLInputElement | null>(null);
  const [images, setImages] =
    useState<LibraryImage[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] =
    useState(0);
  const [totalElements, setTotalElements] =
    useState(0);
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] =
    useState(true);
  const [isAddingUrl, setIsAddingUrl] =
    useState(false);
  const [isUploading, setIsUploading] =
    useState(false);
  const [removingImage, setRemovingImage] =
    useState<LibraryImage | null>(null);
  const [isRemoving, setIsRemoving] =
    useState(false);
  const [loadError, setLoadError] =
    useState<string | null>(null);
  const [actionError, setActionError] =
    useState<string | null>(null);

  const loadImages = useCallback(
    async (targetPage: number) => {
      await Promise.resolve();
      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await getImageLibrary({
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

        setImages(response.items);
        setTotalPages(response.totalPages);
        setTotalElements(response.totalElements);
      } catch (error) {
        setLoadError(getErrorMessage(error));
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const loadTimer = window.setTimeout(
      () => {
        void loadImages(page);
      },
      0,
    );

    return () => window.clearTimeout(loadTimer);
  }, [loadImages, page]);

  async function handleAddUrl(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    const nextUrl = url.trim();

    if (!nextUrl || isAddingUrl) {
      return;
    }

    setIsAddingUrl(true);
    setActionError(null);

    try {
      await addExternalImage(nextUrl);
      setUrl("");

      if (page === 0) {
        await loadImages(0);
      } else {
        setPage(0);
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setIsAddingUrl(false);
    }
  }

  async function handleUpload(file: File | undefined) {
    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setActionError(null);

    try {
      await uploadImage(file);

      if (page === 0) {
        await loadImages(0);
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
    if (!removingImage || isRemoving) {
      return;
    }

    setIsRemoving(true);
    setActionError(null);

    try {
      await removeLibraryImage(
        removingImage.id,
      );
      setRemovingImage(null);

      const nextPage =
        images.length === 1 && page > 0
          ? page - 1
          : page;

      if (nextPage === page) {
        await loadImages(nextPage);
      } else {
        setPage(nextPage);
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <LibraryMediaNavigation className="mb-5" />

        <header className="border-b border-(--border) pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">
                Images
              </h1>
              <p className="mt-1 text-sm text-(--text-muted)">
                Keep exact image sources and capture notes from them.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                window.open(
                  "https://www.google.com/imghp",
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
            >
              <Search size={15} aria-hidden="true" />
              Search Google Images
              <ExternalLink size={13} aria-hidden="true" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <form
              onSubmit={handleAddUrl}
              className="flex min-w-0 flex-col gap-2 sm:flex-row"
            >
              <label htmlFor="image-url" className="sr-only">
                External image URL
              </label>
              <input
                id="image-url"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                disabled={isAddingUrl || isUploading}
                placeholder="https://example.com/image.jpg"
                className="min-w-0 flex-1 rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!url.trim() || isAddingUrl || isUploading}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-(--primary-bg) px-4 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isAddingUrl ? (
                  <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ImagePlus size={15} aria-hidden="true" />
                )}
                Add URL
              </button>
            </form>

            <div>
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                disabled={isAddingUrl || isUploading}
                onChange={(event) =>
                  void handleUpload(event.target.files?.[0])
                }
                className="sr-only"
                id="image-upload"
              />
              <label
                htmlFor="image-upload"
                aria-disabled={isAddingUrl || isUploading}
                className={`inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-(--border) px-4 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-within:ring-2 focus-within:ring-(--focus) ${
                  isAddingUrl || isUploading
                    ? "pointer-events-none opacity-50"
                    : ""
                }`}
              >
                {isUploading ? (
                  <LoaderCircle size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <Upload size={15} aria-hidden="true" />
                )}
                {isUploading ? "Uploading..." : "Upload image"}
              </label>
            </div>
          </div>

          {actionError && (
            <p role="alert" className="mt-3 text-sm text-(--danger-text)">
              {actionError}
            </p>
          )}
        </header>

        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-xs text-(--text-muted)">
            {totalElements} image{totalElements === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={() => void loadImages(page)}
            disabled={isLoading}
            className="text-xs text-(--text-secondary) hover:text-(--text-primary) disabled:opacity-50"
          >
            Refresh
          </button>
        </div>

        {isLoading && images.length === 0 ? (
          <div role="status" className="flex min-h-72 items-center justify-center gap-2 text-sm text-(--text-muted)">
            <LoaderCircle size={18} className="animate-spin" aria-hidden="true" />
            Loading images...
          </div>
        ) : loadError ? (
          <div className="mt-5 rounded-2xl border border-(--danger-border) bg-(--danger-surface) p-5">
            <p role="alert" className="text-sm text-(--danger-text)">{loadError}</p>
            <button type="button" onClick={() => void loadImages(page)} className="mt-3 rounded-lg border border-(--danger-border) px-3 py-2 text-xs text-(--danger-text)">
              Try again
            </button>
          </div>
        ) : images.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-(--border) p-10 text-center">
            <ImagePlus size={30} className="mx-auto text-(--text-muted)" aria-hidden="true" />
            <h2 className="mt-3 text-sm font-medium">No images yet</h2>
            <p className="mt-1 text-sm text-(--text-muted)">
              Add an external URL or upload a JPG, PNG, or WEBP file.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {images.map((image) => {
              const title = getLibraryImageTitle(image);
              const size = formatBytes(image.sizeBytes);

              return (
                <article key={image.id} className="min-w-0 overflow-hidden rounded-2xl border border-(--border) bg-(--surface)">
                  <button
                    type="button"
                    onClick={() => navigate(`/images/${image.id}`)}
                    className="block aspect-[4/3] w-full overflow-hidden bg-(--app-bg) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--focus)"
                  >
                    <ImagePreview
                      sourceId={image.sourceId}
                      origin={image.origin}
                      url={image.url}
                      alt={title}
                      className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.02] motion-reduce:transform-none"
                    />
                  </button>

                  <div className="p-3">
                    <p className="truncate text-sm font-medium" title={title}>{title}</p>
                    <p className="mt-1 text-xs text-(--text-muted)">
                      {image.origin === "UPLOAD" ? "Uploaded" : "External"}
                      {size ? ` · ${size}` : ""}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={() => navigate(`/images/${image.id}`)} className="flex-1 rounded-lg border border-(--border) px-3 py-2 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary)">
                        Open
                      </button>
                      <button type="button" onClick={() => {
                        setActionError(null);
                        setRemovingImage(image);
                      }} aria-label={`Remove ${title} from Library`} className="flex h-9 w-9 items-center justify-center rounded-lg text-(--text-muted) transition hover:bg-(--danger-surface) hover:text-(--danger-text)">
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
      </div>

      <ConfirmDialog
        open={removingImage !== null}
        title="Remove this image from Library?"
        description="This removes only the Library entry. Existing Notes and Tasks keep their exact source context."
        confirmLabel="Remove from Library"
        isBusy={isRemoving}
        errorMessage={actionError}
        onCancel={() => {
          if (!isRemoving) {
            setRemovingImage(null);
            setActionError(null);
          }
        }}
        onConfirm={handleRemove}
      />
    </main>
  );
}
