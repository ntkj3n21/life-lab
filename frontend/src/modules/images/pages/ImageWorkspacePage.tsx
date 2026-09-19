import {
  ArrowLeft,
  LoaderCircle,
  Trash2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

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
    const details = Object.values(
      error.fieldErrors,
    ).filter(Boolean);

    return details.length > 0
      ? details.join(" ")
      : error.message;
  }

  return "Something went wrong.";
}

function formatDate(value: string) {
  const date = new Date(value);

  return Number.isNaN(
    date.getTime(),
  )
    ? value
    : new Intl.DateTimeFormat(
        undefined,
        {
          dateStyle: "medium",
        },
      ).format(date);
}

function getWorkspaceTitle(
  image: LibraryImage,
) {
  const title =
    getLibraryImageTitle(image);

  /*
   * An external image may fall back to its raw URL
   * when it has no useful display title. Keep that
   * exact URL in metadata instead of using it as a
   * large page heading.
   */
  if (
    image.origin === "EXTERNAL" &&
    image.url &&
    title === image.url
  ) {
    return "External image";
  }

  return title;
}

export function ImageWorkspacePage() {
  const navigate = useNavigate();

  const { imageId } = useParams();

  const parsedImageId =
    Number(imageId);

  const validImageId =
    Number.isSafeInteger(
      parsedImageId,
    ) &&
    parsedImageId > 0;

  const [
    image,
    setImage,
  ] =
    useState<LibraryImage | null>(
      null,
    );

  const [
    isLoading,
    setIsLoading,
  ] = useState(validImageId);

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
          "image" &&
        current.entityId ===
          String(parsedImageId)
      ) {
        useContextStore
          .getState()
          .clearActiveContext();
      }
    };
  }, [
    clearActiveContext,
    parsedImageId,
  ]);

  const loadWorkspace =
    useCallback(async () => {
      if (!validImageId) {
        return;
      }

      await Promise.resolve();

      setIsLoading(true);
      setLoadError(null);

      try {
        const nextImage =
          await getLibraryImage(
            parsedImageId,
          );

        const title =
          getWorkspaceTitle(
            nextImage,
          );

        setImage(nextImage);

        setActiveContext({
          entityId: String(
            nextImage.id,
          ),
          entityType: "image",
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
      parsedImageId,
      setActiveContext,
      validImageId,
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

  if (!validImageId) {
    return (
      <Navigate
        to="/images"
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
      await removeLibraryImage(
        parsedImageId,
      );

      navigate("/images", {
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

  const title = image
    ? getWorkspaceTitle(image)
    : "Image";

  const sourceType =
    image?.origin === "UPLOAD"
      ? "Uploaded image"
      : "External image";

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              navigate("/images")
            }
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
          >
            <ArrowLeft
              size={15}
              aria-hidden="true"
            />

            Back to Images
          </button>

          {image && (
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
                Loading image
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
        ) : image ? (
          <>
            <header className="mt-6 min-w-0 border-b border-(--border) pb-5">
              <div className="flex min-w-0 flex-col gap-2">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-(--text-muted)">
                  Image workspace
                </p>

                <h1 className="max-w-4xl wrap-break-word text-xl font-semibold leading-tight text-(--text-primary) sm:text-2xl">
                  {title}
                </h1>

                <p className="max-w-2xl text-sm leading-6 text-(--text-secondary)">
                  Review this image while
                  keeping Notes and Tasks
                  connected to its exact
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
              aria-label="Image source"
              className="mt-5 min-w-0 overflow-hidden rounded-2xl border border-(--border) bg-(--surface)"
            >
              <div className="flex min-h-70 items-center justify-center overflow-hidden bg-(--app-bg) p-3 sm:min-h-105 sm:p-4 lg:min-h-125">
                <ImagePreview
                  sourceId={
                    image.sourceId
                  }
                  origin={
                    image.origin
                  }
                  url={image.url}
                  alt={title}
                  className="max-h-[72vh] max-w-full object-contain"
                />
              </div>

              <div className="border-t border-(--border) bg-(--surface-subtle) p-4 sm:p-5">
                <dl className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                      Source type
                    </dt>

                    <dd className="mt-1 text-sm text-(--text-secondary)">
                      {sourceType}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                      Added to Library
                    </dt>

                    <dd className="mt-1 text-sm text-(--text-secondary)">
                      {formatDate(
                        image.addedAt,
                      )}
                    </dd>
                  </div>

                  <div className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                      Media type
                    </dt>

                    <dd className="mt-1 text-sm text-(--text-secondary)">
                      {image.mediaType ||
                        "Unknown"}
                    </dd>
                  </div>

                  {image.origin ===
                    "EXTERNAL" &&
                    image.url && (
                      <div className="min-w-0 sm:col-span-2 lg:col-span-3">
                        <dt className="text-[11px] font-medium uppercase tracking-wide text-(--text-muted)">
                          Exact source URL
                        </dt>

                        <dd
                          className="mt-1 max-h-24 overflow-y-auto break-all font-mono text-xs leading-5 text-(--text-secondary)"
                          title={
                            image.url
                          }
                        >
                          {image.url}
                        </dd>
                      </div>
                    )}
                </dl>

                <p className="mt-4 border-t border-(--border) pt-4 text-xs leading-5 text-(--text-muted)">
                  Image Notes preserve this
                  exact source. Images do not
                  use timestamps or create
                  WatchSessions.
                </p>
              </div>
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
