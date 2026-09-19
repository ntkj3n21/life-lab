import {
  ImagePlus,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
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
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { ContextSummary } from "../../../components/context/ContextSummary";
import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ApiError } from "../../../lib/api";
import { useContextStore } from "../../../stores/contextStore";
import { LibraryMediaNavigation } from "../../media/components/LibraryMediaNavigation";
import { LibraryPagination } from "../../media/components/LibraryPagination";
import { ImagePreview } from "../components/ImagePreview";
import {
  addExternalImage,
  getImageLibrary,
  getLibraryImage,
  getLibraryImageTitle,
  removeLibraryImage,
  uploadImage,
  type LibraryImage,
} from "../services/imageApi";

const PAGE_SIZE = 12;

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    const details = Object.values(error.fieldErrors).filter(Boolean);

    return details.length > 0 ? details.join(" ") : error.message;
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

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
      }).format(date);
}

function getWorkspaceTitle(image: LibraryImage) {
  const title = getLibraryImageTitle(image);

  if (image.origin === "EXTERNAL" && image.url && title === image.url) {
    return "External image";
  }

  return title;
}

export function ImageLibraryPage() {
  const navigate = useNavigate();
  const { imageId } = useParams();

  const parsedRouteImageId = imageId === undefined ? null : Number(imageId);

  const validRouteImageId =
    parsedRouteImageId !== null &&
    Number.isSafeInteger(parsedRouteImageId) &&
    parsedRouteImageId > 0
      ? parsedRouteImageId
      : null;

  const hasInvalidRouteImageId =
    imageId !== undefined && validRouteImageId === null;

  const workspaceScrollRef = useRef<HTMLElement | null>(null);

  const imageStageRef = useRef<HTMLElement | null>(null);

  const addPanelTriggerRef = useRef<HTMLButtonElement | null>(null);

  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const [images, setImages] = useState<LibraryImage[]>([]);

  const [activeImage, setActiveImage] = useState<LibraryImage | null>(null);

  const [page, setPage] = useState(0);

  const [totalPages, setTotalPages] = useState(0);

  const [totalElements, setTotalElements] = useState(0);

  const [url, setUrl] = useState("");

  const [externalTitle, setExternalTitle] = useState("");

  const [uploadTitle, setUploadTitle] = useState("");

  const [searchText, setSearchText] = useState("");

  const [searchQuery, setSearchQuery] = useState("");

  const [isLoading, setIsLoading] = useState(true);

  const [isActiveLoading, setIsActiveLoading] = useState(false);

  const [activeReloadKey, setActiveReloadKey] = useState(0);

  const [isAddingUrl, setIsAddingUrl] = useState(false);

  const [isUploading, setIsUploading] = useState(false);

  const [removingImage, setRemovingImage] = useState<LibraryImage | null>(null);

  const [isRemoving, setIsRemoving] = useState(false);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeLoadError, setActiveLoadError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  const [isAddPanelOpen, setIsAddPanelOpen] = useState(false);

  const clearActiveContext = useContextStore(
    (state) => state.clearActiveContext,
  );

  const setActiveContext = useContextStore((state) => state.setActiveContext);

  const loadImages = useCallback(
    async (targetPage: number) => {
      await Promise.resolve();

      setIsLoading(true);
      setLoadError(null);

      try {
        const response = await getImageLibrary({
          page: targetPage,
          size: PAGE_SIZE,
          q: searchQuery || undefined,
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
    [searchQuery],
  );

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadImages(page);
    }, 0);

    return () => window.clearTimeout(loadTimer);
  }, [loadImages, page]);

  /*
   * /images has no active source.
   *
   * /images/:imageId resolves the exact Library image
   * and makes it the active source for Right Workspace.
   *
   * Reverse Context may already have established the
   * same Image context, so do not clear it unnecessarily
   * while the route is resolving.
   */
  useEffect(() => {
    let cancelled = false;

    /*
     * Defer route-driven local state synchronization
     * to the next task. This avoids synchronous state
     * updates directly inside the Effect body while
     * preserving exact route/context behavior.
     */
    const routeTimer = window.setTimeout(() => {
      if (cancelled) {
        return;
      }

      if (imageId === undefined) {
        setActiveImage(null);
        setActiveLoadError(null);
        setIsActiveLoading(false);

        const current = useContextStore.getState().activeContext;

        if (current?.entityType === "image") {
          clearActiveContext();
        }

        return;
      }

      if (validRouteImageId === null) {
        return;
      }

      const current = useContextStore.getState().activeContext;

      if (
        current?.entityType === "image" &&
        current.entityId !== String(validRouteImageId)
      ) {
        clearActiveContext();
      }

      setActiveImage(null);
      setActiveLoadError(null);
      setIsActiveLoading(true);

      void getLibraryImage(validRouteImageId)
        .then((nextImage) => {
          if (cancelled) {
            return;
          }

          const title = getWorkspaceTitle(nextImage);

          setActiveImage(nextImage);

          setActiveContext({
            entityId: String(nextImage.id),
            entityType: "image",
            title,
          });
        })
        .catch((error) => {
          if (cancelled) {
            return;
          }

          setActiveLoadError(getErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) {
            setIsActiveLoading(false);
          }
        });
    }, 0);

    return () => {
      cancelled = true;

      window.clearTimeout(routeTimer);
    };
  }, [
    imageId,
    validRouteImageId,
    activeReloadKey,
    clearActiveContext,
    setActiveContext,
  ]);

  /*
   * Leaving the Image workspace entirely must not leave
   * an Image context active in another area of the app.
   */
  useEffect(
    () => () => {
      const current = useContextStore.getState().activeContext;

      if (current?.entityType === "image") {
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
  }, [imageId]);

  if (hasInvalidRouteImageId) {
    return <Navigate to="/images" replace />;
  }

  function closeAddPanelAndRestoreFocus() {
    setIsAddPanelOpen(false);

    window.requestAnimationFrame(() => {
      addPanelTriggerRef.current?.focus();
    });
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setPage(0);
    setSearchQuery(searchText.trim());
  }

  function handleClearSearch() {
    setSearchText("");
    setSearchQuery("");
    setPage(0);
  }

  async function handleAddUrl(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextUrl = url.trim();

    if (!nextUrl || isAddingUrl) {
      return;
    }

    setIsAddingUrl(true);
    setActionError(null);

    try {
      await addExternalImage({
        url: nextUrl,
        title: externalTitle.trim() || null,
      });

      setUrl("");
      setExternalTitle("");
      closeAddPanelAndRestoreFocus();

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
      await uploadImage(file, uploadTitle.trim() || null);

      setUploadTitle("");

      closeAddPanelAndRestoreFocus();

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

    const imageToRemove = removingImage;

    setIsRemoving(true);
    setActionError(null);

    try {
      await removeLibraryImage(imageToRemove.id);

      setRemovingImage(null);

      const removedActiveImage = validRouteImageId === imageToRemove.id;

      if (removedActiveImage) {
        setActiveImage(null);

        const current = useContextStore.getState().activeContext;

        if (
          current?.entityType === "image" &&
          current.entityId === String(imageToRemove.id)
        ) {
          clearActiveContext();
        }

        navigate("/images", {
          replace: true,
        });

        focusImageStage();
      }

      const nextPage = images.length === 1 && page > 0 ? page - 1 : page;

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

  function handleCloseActiveImage() {
    navigate("/images");
    focusImageStage();
  }

  function handleOpenImage(image: LibraryImage) {
    navigate(`/images/${image.id}`);
    focusImageStage();
  }

  function focusImageStage() {
    window.requestAnimationFrame(() => {
      imageStageRef.current?.focus();
    });
  }

  const activeTitle = activeImage ? getWorkspaceTitle(activeImage) : "Image";

  return (
    <main
      ref={workspaceScrollRef}
      className="no-scrollbar min-w-0 flex-1 overflow-y-auto p-4 sm:p-6"
    >
      <div className="mx-auto max-w-7xl">
        <section
          ref={imageStageRef}
          tabIndex={-1}
          aria-label="Image workspace"
          className="rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
        >
          {imageId === undefined ? (
            <div className="flex min-h-56 items-center justify-center rounded-3xl border border-(--border) bg-(--surface) p-6">
              <div className="max-w-lg text-center">
                <ImagePlus
                  className="mx-auto mb-4 text-(--text-muted)"
                  size={56}
                  aria-hidden="true"
                />

                <h3 className="text-lg font-semibold sm:text-xl">
                  No image open
                </h3>

                <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
                  Choose an image from your Library to start studying and taking
                  notes.
                </p>

                {images[0] && (
                  <button
                    type="button"
                    onClick={() => handleOpenImage(images[0])}
                    className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                  >
                    <ImagePlus size={16} aria-hidden="true" />
                    Open first image
                  </button>
                )}
              </div>
            </div>
          ) : isActiveLoading ? (
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
                  Opening image
                </h3>

                <p className="mt-2 text-sm leading-6 text-(--text-secondary)">
                  Loading the saved image context.
                </p>
              </div>
            </div>
          ) : activeLoadError ? (
            <div className="flex min-h-56 items-center justify-center rounded-3xl border border-(--border) bg-(--surface) p-6">
              <div className="max-w-lg text-center">
                <ImagePlus
                  className="mx-auto mb-4 text-(--text-muted)"
                  size={56}
                  aria-hidden="true"
                />

                <h3 className="text-lg font-semibold sm:text-xl">
                  Could not open image
                </h3>

                <p
                  role="alert"
                  className="mt-2 text-sm leading-6 text-(--text-secondary)"
                >
                  {activeLoadError}
                </p>

                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveReloadKey((value) => value + 1);
                      focusImageStage();
                    }}
                    className="rounded-xl bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                  >
                    Try again
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseActiveImage}
                    className="rounded-xl px-4 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                  >
                    Close image
                  </button>
                </div>
              </div>
            </div>
          ) : activeImage ? (
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
                    {activeImage.origin === "UPLOAD"
                      ? "Uploaded image"
                      : "External image"}
                  </div>
                </div>

                <div className="flex w-full items-center justify-end gap-1 sm:w-auto sm:shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActionError(null);
                      setRemovingImage(activeImage);
                    }}
                    aria-label="Remove active image from Library"
                    title="Remove from Library"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border) text-xs font-medium text-(--text-secondary) transition hover:border-(--danger-border) hover:bg-(--danger-surface) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) sm:h-8 sm:w-auto sm:gap-1.5 sm:px-2.5"
                  >
                    <Trash2 size={14} aria-hidden="true" />

                    <span className="hidden sm:inline">Remove</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCloseActiveImage}
                    className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) xl:h-8"
                  >
                    <X size={14} aria-hidden="true" />
                    Close image
                  </button>
                </div>
              </div>

              <div className="mx-auto max-w-5xl">
                <div className="flex min-h-48 items-center justify-center overflow-hidden rounded-3xl border border-(--border) bg-(--app-bg) p-2 sm:min-h-64 sm:p-4">
                  <ImagePreview
                    sourceId={activeImage.sourceId}
                    origin={activeImage.origin}
                    url={activeImage.url}
                    alt={activeTitle}
                    className="max-h-[60vh] w-full object-contain sm:max-h-[68vh]"
                  />
                </div>

                <div className="mt-3 flex flex-col gap-2 rounded-xl border border-(--border) bg-(--surface) p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 text-(--text-muted)">
                    Added {formatDate(activeImage.addedAt)}
                    {activeImage.origin === "UPLOAD" &&
                      activeImage.originalFilename && (
                        <>
                          <span className="mx-2" aria-hidden="true">
                            ·
                          </span>

                          <span
                            title={activeImage.originalFilename}
                            className="text-(--text-secondary)"
                          >
                            File: {activeImage.originalFilename}
                          </span>
                        </>
                      )}
                  </div>

                  {activeImage.origin === "EXTERNAL" && activeImage.url && (
                    <a
                      href={activeImage.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-sm font-medium text-(--text-secondary) underline-offset-4 hover:text-(--text-primary) hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                    >
                      Open original
                    </a>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </section>

        {/* Same "Now working on" row used by Video */}
        <div className="mt-4">
          <ContextSummary />
        </div>

        {/* Library */}
        <section
          aria-busy={isLoading || isAddingUrl || isUploading || isRemoving}
          className="mt-4 w-full rounded-xl border border-(--border) bg-(--surface) p-4 sm:p-5"
        >
          <LibraryMediaNavigation className="mb-4" />

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-(--text-primary)">
                Library
              </h2>

              <p className="mt-1 text-sm text-(--text-muted)">
                Your saved image study sources.
              </p>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
              <span className="rounded-full bg-(--surface-hover) px-2.5 py-1 text-xs text-(--text-secondary)">
                {totalElements} image
                {totalElements === 1 ? "" : "s"}
              </span>

              <button
                ref={addPanelTriggerRef}
                type="button"
                onClick={() => {
                  setActionError(null);

                  setIsAddPanelOpen((open) => !open);
                }}
                aria-expanded={isAddPanelOpen}
                aria-controls="library-add-image-panel"
                aria-label={isAddPanelOpen ? "Close add image" : "Add image"}
                title={isAddPanelOpen ? "Close" : "Add image"}
                className="flex h-10 items-center justify-center gap-1.5 rounded-lg border border-(--border) px-2.5 text-xs font-medium text-(--text-secondary) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) sm:h-8"
              >
                {isAddPanelOpen ? (
                  <X size={14} aria-hidden="true" />
                ) : (
                  <Plus size={14} aria-hidden="true" />
                )}

                <span className="hidden sm:inline">
                  {isAddPanelOpen ? "Close" : "Add image"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void loadImages(page)}
                disabled={isLoading}
                aria-label="Refresh image library"
                title="Refresh image library"
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
          <form
            onSubmit={handleSearch}
            className="mb-4 flex flex-col gap-2 sm:flex-row"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-(--border) bg-(--app-bg) px-3 focus-within:border-(--border-strong) focus-within:ring-2 focus-within:ring-(--focus)">
              <Search
                size={14}
                className="shrink-0 text-(--text-muted)"
                aria-hidden="true"
              />

              <label htmlFor="image-library-search" className="sr-only">
                Search image Library
              </label>

              <input
                id="image-library-search"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="Search images..."
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-(--text-faint)"
              />
            </div>

            <button
              type="submit"
              className="min-h-10 rounded-lg border border-(--border) px-3 text-xs font-medium text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) sm:min-h-9"
            >
              Search
            </button>

            {(searchText || searchQuery) && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="min-h-10 rounded-lg px-3 text-xs text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) sm:min-h-9"
              >
                Clear
              </button>
            )}
          </form>
          {isAddPanelOpen && (
            <div
              id="library-add-image-panel"
              className="mb-3 rounded-xl border border-(--border) bg-(--app-bg) p-3"
            >
              <div className="mb-3">
                <h3 className="text-sm font-medium text-(--text-primary)">
                  Add image
                </h3>

                <p className="mt-1 text-xs text-(--text-muted)">
                  Add an image by URL or upload a JPG, PNG, or WEBP file from
                  your device.
                </p>
              </div>

              <div className="mt-3 border-t border-(--border) pt-3">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <form
                    onSubmit={handleAddUrl}
                    className="grid min-w-0 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.4fr)_auto]"
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
                      className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
                    />

                    <label htmlFor="image-title" className="sr-only">
                      Image title
                    </label>

                    <input
                      id="image-title"
                      value={externalTitle}
                      onChange={(event) => setExternalTitle(event.target.value)}
                      disabled={isAddingUrl || isUploading}
                      maxLength={255}
                      placeholder="Optional title"
                      className="min-w-0 flex-1 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
                    />

                    <button
                      type="submit"
                      disabled={!url.trim() || isAddingUrl || isUploading}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-(--primary-bg) px-3 text-xs font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
                    >
                      {isAddingUrl ? (
                        <LoaderCircle
                          size={14}
                          className="animate-spin"
                          aria-hidden="true"
                        />
                      ) : (
                        <ImagePlus size={14} aria-hidden="true" />
                      )}
                      Add URL
                    </button>
                  </form>

                  <div className="grid gap-2 sm:grid-cols-[minmax(180px,1fr)_auto]">
                    <label htmlFor="image-upload-title" className="sr-only">
                      Image title
                    </label>

                    <input
                      id="image-upload-title"
                      value={uploadTitle}
                      onChange={(event) => setUploadTitle(event.target.value)}
                      disabled={isAddingUrl || isUploading}
                      maxLength={255}
                      placeholder="Optional title"
                      className="min-w-0 rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
                    />

                    <div>
                      <input
                        ref={uploadInputRef}
                        id="image-upload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                        disabled={isAddingUrl || isUploading}
                        onChange={(event) =>
                          void handleUpload(event.target.files?.[0])
                        }
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => uploadInputRef.current?.click()}
                        disabled={isAddingUrl || isUploading}
                        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-(--border) px-3 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
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

                        {isUploading ? "Uploading..." : "Upload image"}
                      </button>
                    </div>
                  </div>
                </div>

                {actionError && (
                  <p role="alert" className="mt-3 text-sm text-(--danger-text)">
                    {actionError}
                  </p>
                )}
              </div>
            </div>
          )}

          {isLoading && images.length === 0 ? (
            <div
              role="status"
              className="flex min-h-72 items-center justify-center gap-2 text-sm text-(--text-muted)"
            >
              <LoaderCircle
                size={18}
                className="animate-spin"
                aria-hidden="true"
              />
              Loading images...
            </div>
          ) : loadError ? (
            <div className="rounded-xl border border-(--danger-border) bg-(--danger-surface) p-5">
              <p role="alert" className="text-sm text-(--danger-text)">
                {loadError}
              </p>

              <button
                type="button"
                onClick={() => void loadImages(page)}
                className="mt-3 rounded-lg border border-(--danger-border) px-3 py-2 text-xs text-(--danger-text)"
              >
                Try again
              </button>
            </div>
          ) : images.length === 0 ? (
            <div className="rounded-xl border border-dashed border-(--border) p-10 text-center">
              <ImagePlus
                size={30}
                className="mx-auto text-(--text-muted)"
                aria-hidden="true"
              />

              <h3 className="mt-3 text-sm font-medium text-(--text-primary)">
                No images yet
              </h3>

              <p className="mt-1 text-sm text-(--text-muted)">
                Add an image by URL or upload a JPG, PNG, or WEBP file from your
                device.
              </p>

              <button
                type="button"
                onClick={() => setIsAddPanelOpen(true)}
                className="mt-4 inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-(--border) px-3 text-xs font-medium text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary)"
              >
                <Plus size={14} aria-hidden="true" />
                Add image
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {images.map((image) => {
                const title = getLibraryImageTitle(image);

                const size = formatBytes(image.sizeBytes);

                const isActive = validRouteImageId === image.id;

                return (
                  <article
                    key={image.id}
                    className={`min-w-0 overflow-visible rounded-xl border transition ${
                      isActive
                        ? "border-(--border-strong) bg-(--surface-hover)"
                        : "border-(--border) bg-(--surface) hover:bg-(--surface-hover)"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenImage(image)}
                      aria-current={isActive ? "true" : undefined}
                      aria-label={`Open image ${title}`}
                      className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--focus)"
                    >
                      <div className="relative aspect-video overflow-hidden bg-(--surface)">
                        <ImagePreview
                          sourceId={image.sourceId}
                          origin={image.origin}
                          url={image.url}
                          alt=""
                          className="h-full w-full object-cover transition-transform duration-200 hover:scale-[1.02] motion-reduce:transform-none"
                        />

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
                        onClick={() => handleOpenImage(image)}
                        className="block min-w-0 w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                      >
                        <h5
                          className="line-clamp-2 wrap-break-word text-sm font-medium leading-5 text-(--text-primary)"
                          title={title}
                        >
                          {title}
                        </h5>
                      </button>

                      <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-(--text-muted)">
                        <span className="min-w-0 truncate">
                          {image.origin === "UPLOAD" ? "Uploaded" : "External"}
                        </span>

                        {size && (
                          <>
                            <span aria-hidden="true">·</span>

                            <span className="shrink-0">{size}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-[11px] text-(--text-muted)">
                          Added {formatDate(image.addedAt)}
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setActionError(null);

                            setRemovingImage(image);
                          }}
                          aria-label={`Remove ${title} from Library`}
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
