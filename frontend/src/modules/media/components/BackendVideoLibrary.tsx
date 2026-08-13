import {
  useEffect,
  useState,
} from "react";
import { Plus, RefreshCw, X } from "lucide-react";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useLibraryStore } from "../../../stores/libraryStore";
import { useTagStore } from "../../../stores/tagStore";
import {
  getLibraryVideoDisplayTitle,
  type LibraryQuery,
  type LibraryVideo,
  type LibraryVideoDeleteImpact,
  type UpdateLibraryVideoInput,
} from "../services/libraryApi";
import { LibraryAddVideoForm } from "./LibraryAddVideoForm";
import {
  LibraryFilters,
  type BooleanFilter,
  type LibrarySortBy,
  type LibrarySortDirection,
} from "./LibraryFilters";
import { LibraryPagination } from "./LibraryPagination";
import { LibraryVideoCard } from "./LibraryVideoCard";
import {
  LibraryViewModes,
  type LibraryViewMode,
} from "./LibraryViewModes";
import { TagManager } from "./TagManager";

interface BackendVideoLibraryProps {
  activeVideoId?: number;

  onOpenVideo: (
    video: LibraryVideo,
  ) => void;

  onVideoDeleted?: (
    libraryVideoId: number,
  ) => void;
}

interface PendingVideoDelete {
  video: LibraryVideo;
  impact: LibraryVideoDeleteImpact;
}

type AppliedLibraryQuery =
  Omit<
    LibraryQuery,
    "page" | "size"
  >;

const DEFAULT_APPLIED_QUERY:
  AppliedLibraryQuery = {
    sortBy: "addedAt",
    sortDirection: "desc",
  };

function applyViewMode(
  query: AppliedLibraryQuery,
  mode: LibraryViewMode,
): AppliedLibraryQuery {
  switch (mode) {
    case "recent":
      return {
        ...query,
        watched: true,
        sortBy: "lastWatchedAt",
        sortDirection: "desc",
      };

    case "most":
      return {
        ...query,
        watched: true,
        sortBy: "viewCount",
        sortDirection: "desc",
      };

    case "all":
      return query;
  }
}

function parseOptionalNonNegativeInteger(
  value: string,
) {
  if (!value.trim()) {
    return {
      value: undefined,
      error: null,
    };
  }

  const parsed =
    Number(value);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 0
  ) {
    return {
      value: undefined,
      error:
        "Duration values must be whole numbers greater than or equal to 0.",
    };
  }

  return {
    value: parsed,
    error: null,
  };
}

export function BackendVideoLibrary({
  activeVideoId,
  onOpenVideo,
  onVideoDeleted,
}: BackendVideoLibraryProps) {
  const videos =
    useLibraryStore(
      (state) => state.videos,
    );

  const page =
    useLibraryStore(
      (state) => state.page,
    );

  const size =
    useLibraryStore(
      (state) => state.size,
    );

  const totalElements =
    useLibraryStore(
      (state) =>
        state.totalElements,
    );

  const totalPages =
    useLibraryStore(
      (state) =>
        state.totalPages,
    );

  const isLoading =
    useLibraryStore(
      (state) => state.isLoading,
    );

  const isMutating =
    useLibraryStore(
      (state) => state.isMutating,
    );

  const error =
    useLibraryStore(
      (state) => state.error,
    );

  const loadLibrary =
    useLibraryStore(
      (state) =>
        state.loadLibrary,
    );

  const updateVideo =
    useLibraryStore(
      (state) =>
        state.updateVideo,
    );

  const getDeleteImpact =
    useLibraryStore(
      (state) =>
        state.getDeleteImpact,
    );

  const deleteVideo =
    useLibraryStore(
      (state) =>
        state.deleteVideo,
    );

  const clearError =
    useLibraryStore(
      (state) =>
        state.clearError,
    );

  const tags =
    useTagStore(
      (state) => state.tags,
    );

  const loadTags =
    useTagStore(
      (state) => state.loadTags,
    );

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    selectedTagIds,
    setSelectedTagIds,
  ] = useState<number[]>([]);

  const [
    minDurationSeconds,
    setMinDurationSeconds,
  ] = useState("");

  const [
    maxDurationSeconds,
    setMaxDurationSeconds,
  ] = useState("");

  const [
    publishedFrom,
    setPublishedFrom,
  ] = useState("");

  const [
    publishedTo,
    setPublishedTo,
  ] = useState("");

  const [
    addedFrom,
    setAddedFrom,
  ] = useState("");

  const [
    addedTo,
    setAddedTo,
  ] = useState("");

  const [
    watchedFilter,
    setWatchedFilter,
  ] =
    useState<BooleanFilter>("");

  const [
    notesFilter,
    setNotesFilter,
  ] =
    useState<BooleanFilter>("");

  const [
    sortBy,
    setSortBy,
  ] =
    useState<LibrarySortBy>(
      "addedAt",
    );

  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<LibrarySortDirection>(
      "desc",
    );

  const [
    viewMode,
    setViewMode,
  ] =
    useState<LibraryViewMode>(
      "all",
    );

  const [
    appliedQuery,
    setAppliedQuery,
  ] =
    useState<AppliedLibraryQuery>(
      DEFAULT_APPLIED_QUERY,
    );

  const [
    validationMessage,
    setValidationMessage,
  ] = useState<
    string | null
  >(null);

  const [
    showAdvancedFilters,
    setShowAdvancedFilters,
  ] = useState(false);

  const [
    pendingDelete,
    setPendingDelete,
  ] =
    useState<PendingVideoDelete | null>(
      null,
    );

  const [
    isPreparingDelete,
    setIsPreparingDelete,
  ] = useState(false);

  const [isAddFormOpen, setIsAddFormOpen] = useState(false);

  useEffect(() => {
    void loadLibrary().catch(() => {
      // libraryStore keeps error.
    });

    void loadTags().catch(() => {
      // tagStore keeps error.
    });
  }, [
    loadLibrary,
    loadTags,
  ]);

  function buildAppliedQuery(
    targetPage: number,
    mode: LibraryViewMode =
      viewMode,
  ): LibraryQuery {
    return {
      page: targetPage,
      size,
      ...applyViewMode(
        appliedQuery,
        mode,
      ),
    };
  }

  function buildDraftQuery():
    | {
        query:
          AppliedLibraryQuery;
        error: null;
      }
    | {
        query: null;
        error: string;
      } {
    const parsedMin =
      parseOptionalNonNegativeInteger(
        minDurationSeconds,
      );

    if (parsedMin.error) {
      return {
        query: null,
        error: parsedMin.error,
      };
    }

    const parsedMax =
      parseOptionalNonNegativeInteger(
        maxDurationSeconds,
      );

    if (parsedMax.error) {
      return {
        query: null,
        error: parsedMax.error,
      };
    }

    if (
      parsedMin.value !==
        undefined &&
      parsedMax.value !==
        undefined &&
      parsedMin.value >
        parsedMax.value
    ) {
      return {
        query: null,
        error:
          "Minimum duration must be less than or equal to maximum duration.",
      };
    }

    if (
      publishedFrom &&
      publishedTo &&
      publishedFrom >
        publishedTo
    ) {
      return {
        query: null,
        error:
          "Published-from date must be on or before published-to date.",
      };
    }

    if (
      addedFrom &&
      addedTo &&
      addedFrom > addedTo
    ) {
      return {
        query: null,
        error:
          "Added-from date must be on or before added-to date.",
      };
    }

    const availableTagIds =
      new Set(
        tags.map(
          (tag) => tag.id,
        ),
      );

    const validTagIds =
      selectedTagIds.filter(
        (tagId) =>
          availableTagIds.has(
            tagId,
          ),
      );

    return {
      error: null,
      query: {
        q:
          searchText.trim() ||
          undefined,

        minDurationSeconds:
          parsedMin.value,

        maxDurationSeconds:
          parsedMax.value,

        publishedFrom:
          publishedFrom ||
          undefined,

        publishedTo:
          publishedTo ||
          undefined,

        addedFrom:
          addedFrom ||
          undefined,

        addedTo:
          addedTo ||
          undefined,

        tagIds:
          validTagIds.length >
          0
            ? validTagIds
            : undefined,

        watched:
          watchedFilter === ""
            ? undefined
            : watchedFilter ===
              "true",

        hasNotes:
          notesFilter === ""
            ? undefined
            : notesFilter ===
              "true",

        sortBy,
        sortDirection,
      },
    };
  }

  async function applyFilters() {
    clearError();
    setValidationMessage(
      null,
    );

    const draft =
      buildDraftQuery();

    if (draft.query === null) {
      setValidationMessage(
        draft.error,
      );
      return;
    }

    setAppliedQuery(
      draft.query,
    );

    try {
      await loadLibrary({
        page: 0,
        size,
        ...applyViewMode(
          draft.query,
          viewMode,
        ),
      });
    } catch {
      // libraryStore keeps error.
    }
  }

  async function resetFilters() {
    setSearchText("");
    setSelectedTagIds([]);
    setMinDurationSeconds("");
    setMaxDurationSeconds("");
    setPublishedFrom("");
    setPublishedTo("");
    setAddedFrom("");
    setAddedTo("");
    setWatchedFilter("");
    setNotesFilter("");
    setSortBy("addedAt");
    setSortDirection("desc");
    setAppliedQuery(
      DEFAULT_APPLIED_QUERY,
    );
    setValidationMessage(
      null,
    );

    clearError();

    try {
      await loadLibrary({
        page: 0,
        size,
        ...applyViewMode(
          DEFAULT_APPLIED_QUERY,
          viewMode,
        ),
      });
    } catch {
      // libraryStore keeps error.
    }
  }

  async function handleChangeViewMode(
    nextMode: LibraryViewMode,
  ) {
    if (
      isLoading ||
      nextMode === viewMode
    ) {
      return;
    }

    clearError();
    setValidationMessage(
      null,
    );

    try {
      await loadLibrary(
        buildAppliedQuery(
          0,
          nextMode,
        ),
      );

      setViewMode(nextMode);
    } catch {
      // libraryStore keeps error.
    }
  }

  function toggleTag(
    tagId: number,
  ) {
    setSelectedTagIds(
      (current) =>
        current.includes(tagId)
          ? current.filter(
              (currentTagId) =>
                currentTagId !==
                tagId,
            )
          : [
              ...current,
              tagId,
            ],
    );
  }

  async function handleUpdateVideo(
    libraryVideoId: number,
    input:
      UpdateLibraryVideoInput,
  ) {
    clearError();

    await updateVideo(
      libraryVideoId,
      input,
    );
  }

  async function handleDeleteVideo(
    video: LibraryVideo,
  ) {
    if (
      isMutating ||
      isPreparingDelete
    ) {
      return;
    }

    clearError();
    setIsPreparingDelete(true);

    try {
      const impact =
        await getDeleteImpact(
          video.id,
        );

      setPendingDelete({
        video,
        impact,
      });
    } catch {
      // libraryStore keeps error.
    } finally {
      setIsPreparingDelete(false);
    }
  }

  async function confirmDeleteVideo() {
    if (
      !pendingDelete ||
      isMutating
    ) {
      return;
    }

    clearError();

    const targetPage =
      videos.length === 1 &&
      page > 0
        ? page - 1
        : page;

    try {
      await deleteVideo(
        pendingDelete.video.id,
      );

      onVideoDeleted?.(
        pendingDelete.video.id,
      );

      setPendingDelete(null);

      await loadLibrary(
        buildAppliedQuery(
          targetPage,
        ),
      );
    } catch {
      // libraryStore keeps error.
    }
  }

  async function handleChangePage(
    nextPage: number,
  ) {
    if (
      isLoading ||
      nextPage < 0 ||
      nextPage >= totalPages
    ) {
      return;
    }

    try {
      await loadLibrary(
        buildAppliedQuery(
          nextPage,
        ),
      );
    } catch {
      // libraryStore keeps error.
    }
  }

  async function handleRefresh() {
    try {
      await Promise.all([
        loadLibrary(
          buildAppliedQuery(page),
        ),
        loadTags(true),
      ]);
    } catch {
      // stores keep errors.
    }
  }

  return (
    <section
      aria-busy={isLoading || isMutating || isPreparingDelete}
      className="w-full rounded-xl border border-(--border) bg-(--surface) p-4 sm:p-5"
    >
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-base font-semibold text-(--text-primary)">
            Library
          </h4>
          <p className="mt-1 text-sm text-(--text-muted)">
            Your saved YouTube study sources.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-(--surface-hover) px-2.5 py-1 text-xs text-(--text-secondary)">
            {totalElements} video{totalElements === 1 ? "" : "s"}
          </span>

          {/* Nút bấm để mở/đóng Form Add Video */}
          <button
            type="button"
            onClick={() => setIsAddFormOpen((open) => !open)}
            aria-expanded={isAddFormOpen}
            aria-controls="library-add-video-panel"
            aria-label={isAddFormOpen ? "Close add video" : "Add video"}
            title={isAddFormOpen ? "Close" : "Add video"}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
          >
            {isAddFormOpen ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
          </button>

          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isLoading}
            aria-label="Refresh library"
            title="Refresh library"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : undefined} />
          </button>
        </div>
      </div>

      <LibraryViewModes
        mode={viewMode}
        isLoading={isLoading}
        onChange={handleChangeViewMode}
      />

      {/* Form Add Video giờ đây chỉ hiện ra khi bấm nút Plus */}
      {isAddFormOpen && (
        <div id="library-add-video-panel" className="mt-3">
          <LibraryAddVideoForm
            onVideoAdded={(video) => {
              setIsAddFormOpen(false); // Tự động đóng form sau khi add thành công
              onOpenVideo(video);
              void loadLibrary(buildAppliedQuery(0)).catch(() => {});
            }}
          />
        </div>
      )}
      <LibraryFilters
        tags={tags}
        searchText={searchText}
        selectedTagIds={
          selectedTagIds
        }
        minDurationSeconds={
          minDurationSeconds
        }
        maxDurationSeconds={
          maxDurationSeconds
        }
        publishedFrom={
          publishedFrom
        }
        publishedTo={publishedTo}
        addedFrom={addedFrom}
        addedTo={addedTo}
        watchedFilter={
          viewMode === "all"
            ? watchedFilter
            : "true"
        }
        notesFilter={
          notesFilter
        }
        sortBy={
          viewMode === "recent"
            ? "lastWatchedAt"
            : viewMode === "most"
              ? "viewCount"
              : sortBy
        }
        sortDirection={
          viewMode === "all"
            ? sortDirection
            : "desc"
        }
        showAdvancedFilters={
          showAdvancedFilters
        }
        isLoading={isLoading}
        watchAndSortLocked={
          viewMode !== "all"
        }
        validationMessage={
          validationMessage
        }
        onSearchTextChange={
          setSearchText
        }
        onToggleTag={toggleTag}
        onMinDurationSecondsChange={
          setMinDurationSeconds
        }
        onMaxDurationSecondsChange={
          setMaxDurationSeconds
        }
        onPublishedFromChange={
          setPublishedFrom
        }
        onPublishedToChange={
          setPublishedTo
        }
        onAddedFromChange={
          setAddedFrom
        }
        onAddedToChange={
          setAddedTo
        }
        onWatchedFilterChange={
          setWatchedFilter
        }
        onNotesFilterChange={
          setNotesFilter
        }
        onSortByChange={
          setSortBy
        }
        onSortDirectionChange={
          setSortDirection
        }
        onToggleAdvancedFilters={() =>
          setShowAdvancedFilters(
            (value) => !value,
          )
        }
        onApply={applyFilters}
        onReset={resetFilters}
      />

      <details className="mt-4">
        <summary className="cursor-pointer select-none text-sm text-(--text-secondary) hover:text-(--text-primary)">
          Manage tags
        </summary>

        <div className="mt-3">
          <TagManager />
        </div>
      </details>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) px-4 py-3"
        >
          <p className="text-sm text-(--danger-text)">
            {error.message}
          </p>

          {Object.keys(
            error.fieldErrors,
          ).length > 0 && (
            <div className="mt-2 space-y-1">
              {Object.entries(
                error.fieldErrors,
              ).map(
                ([
                  field,
                  message,
                ]) => (
                  <p
                    key={field}
                    className="text-xs text-(--danger-text)"
                  >
                    {field}:{" "}
                    {message}
                  </p>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {isLoading &&
      videos.length === 0 ? (
        <div
          role="status"
          className="flex min-h-48 items-center justify-center"
        >
          <p className="text-sm text-(--text-muted)">
            Loading library...
          </p>
        </div>
      ) : videos.length === 0 ? (
        <div
          role="status"
          className="mt-4 rounded-2xl border border-dashed border-(--border) bg-(--app-bg) p-8 text-center"
        >
          <p className="text-sm font-medium text-(--text-secondary)">
            No videos found
          </p>

          <p className="mt-1 text-sm text-(--text-muted)">
            No Library Video matches the current search and filter conditions. Change or reset the conditions to search again.
          </p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {videos.map(
            (video) => (
              <LibraryVideoCard
                key={video.id}
                video={video}
                isActive={
                  activeVideoId ===
                  video.id
                }
                isMutating={
                  isMutating ||
                  isPreparingDelete
                }
                onOpen={
                  onOpenVideo
                }
                onUpdate={
                  handleUpdateVideo
                }
                onDelete={(
                  targetVideo,
                ) =>
                  void handleDeleteVideo(
                    targetVideo,
                  )
                }
              />
            ),
          )}
        </div>
      )}

      <LibraryPagination
        page={page}
        totalPages={totalPages}
        isLoading={isLoading}
        onChangePage={
          handleChangePage
        }
      />

      <ConfirmDialog
        open={
          pendingDelete !== null
        }
        title={
          pendingDelete
            ? `Delete "${getLibraryVideoDisplayTitle(
                pendingDelete.video,
              )}" from your Library?`
            : "Delete video from Library?"
        }
        description="This removes only the personal Library entry and its Library-specific data. Historical Note and Task context is preserved according to the impact below."
        details={
          pendingDelete
            ? [
                `${pendingDelete.impact.watchSessionCountToDelete} watch session(s) will be deleted.`,
                `${pendingDelete.impact.tagLinkCountToDelete} tag link(s) will be removed.`,
                `${pendingDelete.impact.noteCountPreserved} note(s) will be preserved.`,
                `${pendingDelete.impact.taskCountPreserved} task(s) will be preserved.`,
                pendingDelete.impact.youtubeSourcePreserved
                  ? "The exact YouTube source will be preserved."
                  : "The exact YouTube source will not be preserved.",
              ]
            : []
        }
        confirmLabel="Remove from Library"
        isBusy={isMutating}
        errorMessage={
          pendingDelete
            ? error?.message ??
              null
            : null
        }
        onConfirm={
          confirmDeleteVideo
        }
        onCancel={() =>
          setPendingDelete(null)
        }
      />
    </section>
  );
}
