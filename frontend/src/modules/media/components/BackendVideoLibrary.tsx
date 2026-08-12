import {
  useEffect,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import { useLibraryStore } from "../../../stores/libraryStore";
import { useTagStore } from "../../../stores/tagStore";
import {
  getLibraryVideoDisplayTitle,
  type LibraryQuery,
  type LibraryVideo,
  type UpdateLibraryVideoInput,
} from "../services/libraryApi";
import { LibraryAddVideoForm } from "./LibraryAddVideoForm";
import { LibraryVideoCard } from "./LibraryVideoCard";
import { TagManager } from "./TagManager";

type BooleanFilter = "" | "true" | "false";

interface BackendVideoLibraryProps {
  activeVideoId?: number;

  onOpenVideo: (
    video: LibraryVideo,
  ) => void;

  onVideoDeleted?: (
    libraryVideoId: number,
  ) => void;
}

export function BackendVideoLibrary({
  activeVideoId,
  onOpenVideo,
  onVideoDeleted,
}: BackendVideoLibraryProps) {
  const videos = useLibraryStore(
    (state) => state.videos,
  );

  const page = useLibraryStore(
    (state) => state.page,
  );

  const size = useLibraryStore(
    (state) => state.size,
  );

  const totalElements =
    useLibraryStore(
      (state) =>
        state.totalElements,
    );

  const totalPages =
    useLibraryStore(
      (state) => state.totalPages,
    );

  const isLoading = useLibraryStore(
    (state) => state.isLoading,
  );

  const isMutating =
    useLibraryStore(
      (state) =>
        state.isMutating,
    );

  const error = useLibraryStore(
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

  const tags = useTagStore(
    (state) => state.tags,
  );

  const loadTags = useTagStore(
    (state) => state.loadTags,
  );

  const [searchText, setSearchText] =
    useState("");

  const [
    selectedTagId,
    setSelectedTagId,
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

  const [sortBy, setSortBy] =
    useState<
      NonNullable<
        LibraryQuery["sortBy"]
      >
    >("addedAt");

  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<
      NonNullable<
        LibraryQuery["sortDirection"]
      >
    >("desc");

  const [
    showAdvancedFilters,
    setShowAdvancedFilters,
  ] = useState(false);

  useEffect(() => {
    void loadLibrary().catch(() => {
      // libraryStore keeps error.
    });

    void loadTags().catch(() => {
      // tagStore keeps error.
    });
  }, [loadLibrary, loadTags]);

  function buildCurrentQuery(
    targetPage: number,
  ): LibraryQuery {
    const parsedTagId =
      Number(selectedTagId);

    return {
      page: targetPage,
      size,

      q:
        searchText.trim() ||
        undefined,

      tagIds:
        selectedTagId &&
        Number.isFinite(
          parsedTagId,
        )
          ? [parsedTagId]
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
    };
  }

  async function applyFilters() {
    clearError();

    try {
      await loadLibrary(
        buildCurrentQuery(0),
      );
    } catch {
      // libraryStore keeps error.
    }
  }

  async function resetFilters() {
    setSearchText("");
    setSelectedTagId("");
    setWatchedFilter("");
    setNotesFilter("");
    setSortBy("addedAt");
    setSortDirection("desc");

    clearError();

    try {
      await loadLibrary({
        page: 0,
        size,
        sortBy: "addedAt",
        sortDirection: "desc",
      });
    } catch {
      // libraryStore keeps error.
    }
  }

  async function handleUpdateVideo(
    libraryVideoId: number,
    input: UpdateLibraryVideoInput,
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
    if (isMutating) {
      return;
    }

    clearError();

    try {
      const impact =
        await getDeleteImpact(
          video.id,
        );

      const displayTitle =
        getLibraryVideoDisplayTitle(
          video,
        );

      const confirmed =
        window.confirm(
          [
            `Delete "${displayTitle}" from your library?`,
            "",
            `${impact.watchSessionCountToDelete} watch session(s) will be deleted.`,
            `${impact.tagLinkCountToDelete} tag link(s) will be removed.`,
            `${impact.noteCountPreserved} note(s) will be preserved.`,
            `${impact.taskCountPreserved} task(s) will be preserved.`,
            impact.youtubeSourcePreserved
              ? "The YouTube source will be preserved."
              : "The YouTube source will not be preserved.",
          ].join("\n"),
        );

      if (!confirmed) {
        return;
      }

      await deleteVideo(video.id);

      onVideoDeleted?.(
        video.id,
      );

      const targetPage =
        videos.length === 1 &&
        page > 0
          ? page - 1
          : page;

      await loadLibrary(
        buildCurrentQuery(
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
        buildCurrentQuery(
          nextPage,
        ),
      );
    } catch {
      // libraryStore keeps error.
    }
  }

  async function handleRefresh() {
    try {
      await loadLibrary(
        buildCurrentQuery(page),
      );

      await loadTags(true);
    } catch {
      // stores keep errors.
    }
  }

  return (
    <section className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="font-medium">
            Video Library
          </h4>

          <p className="mt-1 text-sm text-neutral-500">
            Your YouTube sources
            stored in Life Lab.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs text-neutral-400">
            {totalElements} video
            {totalElements === 1
              ? ""
              : "s"}
          </span>

          <button
            type="button"
            onClick={() =>
              void handleRefresh()
            }
            disabled={isLoading}
            title="Refresh library"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-800 text-neutral-500 transition hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                isLoading
                  ? "animate-spin"
                  : undefined
              }
            />
          </button>
        </div>
      </div>

      <LibraryAddVideoForm
        onVideoAdded={(video) => {
          onOpenVideo(video);

          void loadLibrary(
            buildCurrentQuery(0),
          ).catch(() => {
            // libraryStore keeps error.
          });
        }}
      />

      <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3">
            <Search
              size={15}
              className="shrink-0 text-neutral-500"
            />

            <input
              value={searchText}
              onChange={(event) =>
                setSearchText(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  void applyFilters();
                }
              }}
              placeholder="Search videos..."
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-neutral-600"
            />
          </div>

          <button
            type="button"
            onClick={() =>
              void applyFilters()
            }
            disabled={isLoading}
            className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
          >
            Search
          </button>

          <button
            type="button"
            onClick={() =>
              setShowAdvancedFilters(
                (value) => !value,
              )
            }
            className="flex items-center justify-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white"
          >
            <SlidersHorizontal
              size={15}
            />
            Filters
          </button>

          <button
            type="button"
            onClick={() =>
              void resetFilters()
            }
            disabled={isLoading}
            title="Reset filters"
            className="flex items-center justify-center rounded-xl border border-neutral-800 px-3 py-2 text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:opacity-50"
          >
            <RotateCcw
              size={15}
            />
          </button>
        </div>

        {showAdvancedFilters && (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            <select
              value={selectedTagId}
              onChange={(event) =>
                setSelectedTagId(
                  event.target.value,
                )
              }
              className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none"
            >
              <option value="">
                All tags
              </option>

              {tags.map((tag) => (
                <option
                  key={tag.id}
                  value={tag.id}
                >
                  {tag.name}
                </option>
              ))}
            </select>

            <select
              value={watchedFilter}
              onChange={(event) =>
                setWatchedFilter(
                  event.target
                    .value as BooleanFilter,
                )
              }
              className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none"
            >
              <option value="">
                Any watch status
              </option>
              <option value="true">
                Watched
              </option>
              <option value="false">
                Not watched
              </option>
            </select>

            <select
              value={notesFilter}
              onChange={(event) =>
                setNotesFilter(
                  event.target
                    .value as BooleanFilter,
                )
              }
              className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none"
            >
              <option value="">
                Any note status
              </option>
              <option value="true">
                Has notes
              </option>
              <option value="false">
                No notes
              </option>
            </select>

            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(
                  event.target
                    .value as NonNullable<
                    LibraryQuery["sortBy"]
                  >,
                )
              }
              className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none"
            >
              <option value="addedAt">
                Added date
              </option>
              <option value="duration">
                Duration
              </option>
              <option value="viewCount">
                View count
              </option>
              <option value="lastWatchedAt">
                Last watched
              </option>
            </select>

            <select
              value={sortDirection}
              onChange={(event) =>
                setSortDirection(
                  event.target
                    .value as NonNullable<
                    LibraryQuery["sortDirection"]
                  >,
                )
              }
              className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none"
            >
              <option value="desc">
                Descending
              </option>
              <option value="asc">
                Ascending
              </option>
            </select>
          </div>
        )}
      </div>

      <details className="mt-4">
        <summary className="cursor-pointer select-none text-sm text-neutral-400 hover:text-white">
          Manage tags
        </summary>

        <div className="mt-3">
          <TagManager />
        </div>
      </details>

      {error && (
        <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3">
          <p className="text-sm text-red-300">
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
                    className="text-xs text-red-400"
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
        <div className="flex min-h-48 items-center justify-center">
          <p className="text-sm text-neutral-500">
            Loading library...
          </p>
        </div>
      ) : videos.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 p-8 text-center">
          <p className="text-sm font-medium text-neutral-300">
            No videos found
          </p>

          <p className="mt-1 text-sm text-neutral-500">
            Try changing your search
            or filters.
          </p>
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
          {videos.map((video) => (
            <LibraryVideoCard
              key={video.id}
              video={video}
              isActive={
                activeVideoId ===
                video.id
              }
              isMutating={
                isMutating
              }
              onOpen={onOpenVideo}
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
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between border-t border-neutral-800 pt-4">
          <p className="text-xs text-neutral-500">
            Page {page + 1} of{" "}
            {totalPages}
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                void handleChangePage(
                  page - 1,
                )
              }
              disabled={
                page === 0 ||
                isLoading
              }
              className="flex items-center gap-1 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-40"
            >
              <ChevronLeft
                size={14}
              />
              Previous
            </button>

            <button
              type="button"
              onClick={() =>
                void handleChangePage(
                  page + 1,
                )
              }
              disabled={
                page + 1 >=
                  totalPages ||
                isLoading
              }
              className="flex items-center gap-1 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-40"
            >
              Next
              <ChevronRight
                size={14}
              />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}