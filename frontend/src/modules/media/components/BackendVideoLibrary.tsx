import {
  useEffect,
  useState,
} from "react";
import {
  ExternalLink,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useLibraryStore } from "../../../stores/libraryStore";
import { useTagStore } from "../../../stores/tagStore";
import {
  getLibraryVideoDisplayTitle,
  type LibraryNavigationQuery,
  type LibraryQuery,
  type LibraryVideo,
  type LibraryVideoDeleteImpact,
  type UpdateLibraryVideoInput,
} from "../services/libraryApi";
import { LibraryAddVideoForm } from "./LibraryAddVideoForm";
import {
  type AppliedLibraryFilterItem,
  LibraryFilters,
  type BooleanFilter,
  type LibrarySortBy,
  type LibrarySortDirection,
} from "./LibraryFilters";
import { LibraryPagination } from "./LibraryPagination";
import { LibraryMediaNavigation } from "./LibraryMediaNavigation";
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
    navigationQuery: LibraryNavigationQuery,
  ) => void;

  onNavigationQueryChange: (
    navigationQuery: LibraryNavigationQuery,
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
  LibraryNavigationQuery;

const DEFAULT_APPLIED_QUERY:
  AppliedLibraryQuery = {
    sortBy: "addedAt",
    sortDirection: "desc",
  };

const LIBRARY_FIELD_LABELS: Record<
  string,
  string
> = {
  q: "Keyword",
  minDurationSeconds:
    "Minimum duration",
  maxDurationSeconds:
    "Maximum duration",
  publishedFrom:
    "Published from",
  publishedTo: "Published to",
  addedFrom: "Added from",
  addedTo: "Added to",
  tagId: "Tag",
  tagIds: "Tags",
  watched: "Watch status",
  hasNotes: "Note status",
  sortBy: "Sort by",
  sortDirection:
    "Sort direction",
  page: "Page",
  size: "Page size",
  youtubeUrl: "YouTube URL",
  customTitle: "Custom title",
  personalDescription:
    "Personal description",
};

function getLibraryFieldLabel(
  field: string,
) {
  const mappedLabel =
    LIBRARY_FIELD_LABELS[field];

  if (mappedLabel) {
    return mappedLabel;
  }

  const words = field
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();

  return words
    ? words.charAt(0).toUpperCase() +
        words.slice(1)
    : "Field";
}

function getLibraryValidationMessage(
  field: string,
  message: string,
) {
  const fieldLabels = {
    ...LIBRARY_FIELD_LABELS,
    [field]:
      getLibraryFieldLabel(field),
  };

  const identifiers =
    Object.keys(fieldLabels)
      .filter((identifier) =>
        /[A-Z_-]/.test(identifier),
      )
      .sort(
        (left, right) =>
          right.length - left.length,
      );

  const presentationMessage =
    identifiers.reduce(
      (result, identifier) => {
        const escapedIdentifier =
          identifier.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          );

        return result.replace(
          new RegExp(
            `\\b${escapedIdentifier}\\b`,
            "g",
          ),
          fieldLabels[identifier],
        );
      },
      message.trim(),
    );

  if (
    !presentationMessage ||
    /[.!?]$/.test(
      presentationMessage,
    )
  ) {
    return presentationMessage;
  }

  return `${presentationMessage}.`;
}

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

function hasAppliedLibraryFilters(
  query: AppliedLibraryQuery,
) {
  return Boolean(
    query.q ||
      query.minDurationSeconds !==
        undefined ||
      query.maxDurationSeconds !==
        undefined ||
      query.publishedFrom ||
      query.publishedTo ||
      query.addedFrom ||
      query.addedTo ||
      query.tagIds?.length ||
      query.watched !== undefined ||
      query.hasNotes !== undefined,
  );
}

const LIBRARY_FILTER_DATE_FORMATTER =
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

function formatAppliedDuration(
  seconds: number,
) {
  if (seconds < 60) {
    return `${seconds} sec`;
  }

  const minutes = Math.floor(
    seconds / 60,
  );
  const remainingSeconds =
    seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes} min`;
  }

  return `${minutes} min ${remainingSeconds} sec`;
}

function formatAppliedDate(
  value: string,
) {
  const date = new Date(
    `${value}T00:00:00Z`,
  );

  return Number.isNaN(date.getTime())
    ? value
    : LIBRARY_FILTER_DATE_FORMATTER.format(
        date,
      );
}

function getAppliedFilterItems(
  query: AppliedLibraryQuery,
  tags: Array<{
    id: number;
    name: string;
  }>,
  viewMode: LibraryViewMode,
): AppliedLibraryFilterItem[] {
  const items:
    AppliedLibraryFilterItem[] =
    [];

  if (query.q) {
    items.push({
      id: "q",
      label: `Search: “${query.q}”`,
    });
  }

  query.tagIds?.forEach(
    (tagId) => {
      const tag = tags.find(
        (candidate) =>
          candidate.id === tagId,
      );

      items.push({
        id: `tag:${tagId}`,
        label:
          tag?.name ??
          "Selected tag",
      });
    },
  );

  if (
    viewMode === "all" &&
    query.watched !== undefined
  ) {
    items.push({
      id: "watched",
      label: query.watched
        ? "Watched"
        : "Not watched",
    });
  }

  if (query.hasNotes !== undefined) {
    items.push({
      id: "hasNotes",
      label: query.hasNotes
        ? "Has notes"
        : "No notes",
    });
  }

  if (
    query.minDurationSeconds !==
    undefined
  ) {
    items.push({
      id: "minDurationSeconds",
      label: `Minimum ${formatAppliedDuration(
        query.minDurationSeconds,
      )}`,
    });
  }

  if (
    query.maxDurationSeconds !==
    undefined
  ) {
    items.push({
      id: "maxDurationSeconds",
      label: `Maximum ${formatAppliedDuration(
        query.maxDurationSeconds,
      )}`,
    });
  }

  if (query.publishedFrom) {
    items.push({
      id: "publishedFrom",
      label: `Published from ${formatAppliedDate(
        query.publishedFrom,
      )}`,
    });
  }

  if (query.publishedTo) {
    items.push({
      id: "publishedTo",
      label: `Published to ${formatAppliedDate(
        query.publishedTo,
      )}`,
    });
  }

  if (query.addedFrom) {
    items.push({
      id: "addedFrom",
      label: `Added from ${formatAppliedDate(
        query.addedFrom,
      )}`,
    });
  }

  if (query.addedTo) {
    items.push({
      id: "addedTo",
      label: `Added to ${formatAppliedDate(
        query.addedTo,
      )}`,
    });
  }

  return items;
}

export function BackendVideoLibrary({
  activeVideoId,
  onOpenVideo,
  onNavigationQueryChange,
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

  const hasLoaded =
    useLibraryStore(
      (state) => state.hasLoaded,
    );

  const hasLoadError =
    useLibraryStore(
      (state) => state.hasLoadError,
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
  const [youtubeSearchText, setYoutubeSearchText] = useState("");
  const [
    activeMenuVideoId,
    setActiveMenuVideoId,
  ] = useState<number | null>(null);
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

  useEffect(() => {
    onNavigationQueryChange(
      applyViewMode(
        appliedQuery,
        viewMode,
      ),
    );
  }, [
    appliedQuery,
    viewMode,
    onNavigationQueryChange,
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
          appliedQuery.q,

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
    setActiveMenuVideoId(null);
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

    try {
      await loadLibrary({
        page: 0,
        size,
        ...applyViewMode(
          draft.query,
          viewMode,
        ),
      });

      setAppliedQuery(
        draft.query,
      );
      setShowAdvancedFilters(false);
    } catch {
      // libraryStore keeps error.
    }
  }

  async function applySearch() {
    setActiveMenuVideoId(null);
    clearError();
    setValidationMessage(null);

    const nextQuery = {
      ...appliedQuery,
      q:
        searchText.trim() ||
        undefined,
    };

    try {
      await loadLibrary({
        page: 0,
        size,
        ...applyViewMode(
          nextQuery,
          viewMode,
        ),
      });

      setAppliedQuery(nextQuery);
    } catch {
      // libraryStore keeps error.
    }
  }

  function initializeFilterDraft(
    query: AppliedLibraryQuery,
  ) {
    setSelectedTagIds(
      query.tagIds ?? [],
    );
    setMinDurationSeconds(
      query.minDurationSeconds?.toString() ??
        "",
    );
    setMaxDurationSeconds(
      query.maxDurationSeconds?.toString() ??
        "",
    );
    setPublishedFrom(
      query.publishedFrom ?? "",
    );
    setPublishedTo(
      query.publishedTo ?? "",
    );
    setAddedFrom(
      query.addedFrom ?? "",
    );
    setAddedTo(
      query.addedTo ?? "",
    );
    setWatchedFilter(
      query.watched === undefined
        ? ""
        : query.watched
          ? "true"
          : "false",
    );
    setNotesFilter(
      query.hasNotes === undefined
        ? ""
        : query.hasNotes
          ? "true"
          : "false",
    );
    setSortBy(
      query.sortBy ?? "addedAt",
    );
    setSortDirection(
      query.sortDirection ?? "desc",
    );
  }

  function openAdvancedFilters() {
    initializeFilterDraft(
      appliedQuery,
    );
    setValidationMessage(null);
    clearError();
    setActiveMenuVideoId(null);
    setShowAdvancedFilters(true);
  }

  function dismissAdvancedFilters() {
    if (isLoading) {
      return;
    }

    setValidationMessage(null);
    setShowAdvancedFilters(false);
  }

  function resetFilterDraft() {
    initializeFilterDraft(
      DEFAULT_APPLIED_QUERY,
    );
    setValidationMessage(null);
  }

  async function resetFilters() {
    setActiveMenuVideoId(null);
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

      setAppliedQuery(
        DEFAULT_APPLIED_QUERY,
      );
    } catch {
      // libraryStore keeps error.
    }
  }

  async function removeAppliedFilter(
    filterId: string,
  ) {
    setActiveMenuVideoId(null);
    let nextQuery = {
      ...appliedQuery,
    };

    if (filterId.startsWith("tag:")) {
      const tagId = Number(
        filterId.slice(4),
      );

      if (!Number.isSafeInteger(tagId)) {
        return;
      }

      const nextTagIds =
        appliedQuery.tagIds?.filter(
          (candidateId) =>
            candidateId !== tagId,
        );

      nextQuery = {
        ...nextQuery,
        tagIds:
          nextTagIds &&
          nextTagIds.length > 0
            ? nextTagIds
            : undefined,
      };

      setSelectedTagIds(
        (current) =>
          current.filter(
            (candidateId) =>
              candidateId !== tagId,
          ),
      );
    } else {
      switch (filterId) {
        case "q":
          nextQuery = {
            ...nextQuery,
            q: undefined,
          };
          setSearchText("");
          break;

        case "minDurationSeconds":
          nextQuery = {
            ...nextQuery,
            minDurationSeconds:
              undefined,
          };
          setMinDurationSeconds("");
          break;

        case "maxDurationSeconds":
          nextQuery = {
            ...nextQuery,
            maxDurationSeconds:
              undefined,
          };
          setMaxDurationSeconds("");
          break;

        case "publishedFrom":
          nextQuery = {
            ...nextQuery,
            publishedFrom: undefined,
          };
          setPublishedFrom("");
          break;

        case "publishedTo":
          nextQuery = {
            ...nextQuery,
            publishedTo: undefined,
          };
          setPublishedTo("");
          break;

        case "addedFrom":
          nextQuery = {
            ...nextQuery,
            addedFrom: undefined,
          };
          setAddedFrom("");
          break;

        case "addedTo":
          nextQuery = {
            ...nextQuery,
            addedTo: undefined,
          };
          setAddedTo("");
          break;

        case "watched":
          nextQuery = {
            ...nextQuery,
            watched: undefined,
          };
          setWatchedFilter("");
          break;

        case "hasNotes":
          nextQuery = {
            ...nextQuery,
            hasNotes: undefined,
          };
          setNotesFilter("");
          break;

        default:
          return;
      }
    }

    setValidationMessage(null);
    clearError();

    try {
      await loadLibrary({
        page: 0,
        size,
        ...applyViewMode(
          nextQuery,
          viewMode,
        ),
      });

      setAppliedQuery(nextQuery);
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

    setActiveMenuVideoId(null);
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

    setActiveMenuVideoId(null);
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
    setActiveMenuVideoId(null);
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

  function handleYouTubeSearch() {
    const query =
      youtubeSearchText.trim();

    if (!query) {
      return;
    }

    const url =
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

    const width = 900;
    const height = 700;

    const left =
      window.screenX +
      window.outerWidth -
      width -
      24;

    const top =
      window.screenY + 70;

    window.open(
      url,
      "life-lab-youtube-search",
      [
        `width=${width}`,
        `height=${height}`,
        `left=${Math.max(left, 0)}`,
        `top=${Math.max(top, 0)}`,
        "resizable=yes",
        "scrollbars=yes",
        "noopener,noreferrer",
      ].join(","),
    );
  }

  const hasActiveFilters =
    hasAppliedLibraryFilters(
      appliedQuery,
    );

  const appliedFilterItems =
    getAppliedFilterItems(
      appliedQuery,
      tags,
      viewMode,
    );

  const isTrulyEmptyLibrary =
    hasLoaded &&
    !hasLoadError &&
    totalElements === 0 &&
    viewMode === "all" &&
    !hasActiveFilters;

  const isAwaitingInitialLoad =
    !hasLoaded &&
    !hasLoadError;

  const shouldShowLoadErrorOnly =
    hasLoadError &&
    videos.length === 0;

  const shouldShowLoadingState =
    !shouldShowLoadErrorOnly &&
    (isAwaitingInitialLoad ||
      (isLoading &&
        videos.length === 0));

  return (
    <section
      aria-busy={isLoading || isMutating || isPreparingDelete}
      className="w-full rounded-xl border border-(--border) bg-(--surface) p-4 sm:p-5"
    >
      <LibraryMediaNavigation className="mb-4" />

      <div className="mb-4 flex items-start justify-between gap-6">
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-(--text-primary)">
            Library
          </h4>

          <p className="mt-1 text-sm text-(--text-muted)">
            Your saved YouTube study sources.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-(--surface-hover) px-2.5 py-1 text-xs text-(--text-secondary)">
            {totalElements} video
            {totalElements === 1 ? "" : "s"}
          </span>

          <button
            type="button"
            onClick={() =>
              setIsAddFormOpen(
                (open) => !open,
              )
            }
            aria-expanded={isAddFormOpen}
            aria-controls="library-add-video-panel"
            aria-label={
              isAddFormOpen
                ? "Close find or add video"
                : "Find or add YouTube video"
            }
            title={
              isAddFormOpen
                ? "Close"
                : "Find or add video"
            }
            className="flex h-8 items-center justify-center gap-1.5 rounded-lg border border-(--border) px-2.5 text-xs font-medium text-(--text-secondary) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
          >
            {isAddFormOpen ? (
              <X
                size={14}
                aria-hidden="true"
              />
            ) : (
              <Plus
                size={14}
                aria-hidden="true"
              />
            )}

            <span className="hidden sm:inline">
              {isAddFormOpen
                ? "Close"
                : "Find / Add"}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              void handleRefresh()
            }
            disabled={isLoading}
            aria-label="Refresh library"
            title="Refresh library"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={
                isLoading
                  ? "animate-spin"
                  : undefined
              }
              aria-hidden="true"
            />
          </button>

        </div>
      </div>

      {isAddFormOpen && (
        <div
          id="library-add-video-panel"
          className="mb-3 rounded-xl border border-(--border) bg-(--app-bg) p-3"
        >
          <div className="mb-3">
            <h5 className="text-sm font-medium text-(--text-primary)">
              Find or add a YouTube video
            </h5>
            <p className="mt-1 text-xs text-(--text-muted)">
              Discover on YouTube, then paste the video URL below to add it to your Library.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-(--border) bg-(--surface) px-3 transition focus-within:border-(--border-strong) focus-within:ring-2 focus-within:ring-(--focus)">
              <Search
                size={14}
                className="shrink-0 text-(--text-muted)"
                aria-hidden="true"
              />

              <label
                htmlFor="youtube-discovery-search"
                className="sr-only"
              >
                Search YouTube
              </label>

              <input
                id="youtube-discovery-search"
                value={youtubeSearchText}
                onChange={(event) =>
                  setYoutubeSearchText(
                    event.target.value,
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    handleYouTubeSearch();
                  }

                  if (event.key === "Escape") {
                    setIsAddFormOpen(false);
                  }
                }}
                autoFocus
                placeholder="Search YouTube..."
                className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-(--text-faint)"
              />
            </div>

            <button
              type="button"
              onClick={handleYouTubeSearch}
              disabled={
                !youtubeSearchText.trim()
              }
              aria-label="Open YouTube search"
              title="Search YouTube"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-(--primary-bg) text-(--primary-text) transition-colors hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ExternalLink
                size={14}
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="mt-3 border-t border-(--border) pt-3">
            <LibraryAddVideoForm
              onVideoAdded={(video) => {
                setActiveMenuVideoId(null);
                setIsAddFormOpen(false);
                onOpenVideo(
                  video,
                  applyViewMode(
                    appliedQuery,
                    viewMode,
                  ),
                );
                void loadLibrary(buildAppliedQuery(0)).catch(() => {});
              }}
            />
          </div>
        </div>
      )}

      <LibraryViewModes
        mode={viewMode}
        isLoading={isLoading}
        onChange={handleChangeViewMode}
      />

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
        errorMessage={
          showAdvancedFilters
            ? error?.message
            : null
        }
        appliedFilters={
          appliedFilterItems
        }
        onSearchTextChange={
          setSearchText
        }
        onApplySearch={applySearch}
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
        onOpenAdvancedFilters={
          openAdvancedFilters
        }
        onDismissAdvancedFilters={
          dismissAdvancedFilters
        }
        onApply={applyFilters}
        onResetDraft={
          resetFilterDraft
        }
        onClearAll={resetFilters}
        onRemoveAppliedFilter={
          removeAppliedFilter
        }
      />

      <details className="mt-4">
        <summary className="cursor-pointer select-none rounded-lg text-sm text-(--text-secondary) outline-none hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus)">
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
                    {getLibraryFieldLabel(
                      field,
                    )}:{" "}
                    {getLibraryValidationMessage(
                      field,
                      message,
                    )}
                  </p>
                ),
              )}
            </div>
          )}
        </div>
      )}

      {shouldShowLoadErrorOnly ? null : shouldShowLoadingState ? (
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
            {isTrulyEmptyLibrary
              ? "Your Library is empty"
              : "No matching videos"}
          </p>

          <p className="mt-1 text-sm text-(--text-muted)">
            {isTrulyEmptyLibrary
              ? "Add your first YouTube video to start building your saved study sources."
              : "Try changing your search, filters, or Library view to find different videos."}
          </p>

          {isTrulyEmptyLibrary ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setIsAddFormOpen(true)
                }
                className="rounded-lg bg-(--primary-bg) px-3 py-2 text-xs font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
              >
                Find or add your first video
              </button>
            </div>
          ) : hasActiveFilters ? (
            <button
              type="button"
              onClick={() =>
                void resetFilters()
              }
              disabled={isLoading}
              className="mt-4 rounded-lg border border-(--border) px-3 py-2 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset filters
            </button>
          ) : null}
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
                viewMode={viewMode}
                isActionsOpen={
                  activeMenuVideoId ===
                  video.id
                }
                onOpen={(targetVideo) => {
                  setActiveMenuVideoId(null);
                  onOpenVideo(
                    targetVideo,
                    applyViewMode(
                      appliedQuery,
                      viewMode,
                    ),
                  );
                }}
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
                onToggleActions={() =>
                  setActiveMenuVideoId(
                    (current) =>
                      current === video.id
                        ? null
                        : video.id,
                  )
                }
                onCloseActions={() =>
                  setActiveMenuVideoId(
                    (current) =>
                      current === video.id
                        ? null
                        : current,
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
        description="This removes the personal Library entry, its watch history, and its assigned tags. Notes and Tasks are preserved; exact YouTube source preservation is shown below."
        details={
          pendingDelete
            ? [
                `${pendingDelete.impact.watchSessionCountToDelete} watch history ${pendingDelete.impact.watchSessionCountToDelete === 1 ? "entry" : "entries"} will be removed.`,
                `${pendingDelete.impact.tagLinkCountToDelete} ${pendingDelete.impact.tagLinkCountToDelete === 1 ? "tag" : "tags"} will be removed from this Library video.`,
                `${pendingDelete.impact.noteCountPreserved} ${pendingDelete.impact.noteCountPreserved === 1 ? "Note" : "Notes"} will be preserved.`,
                `${pendingDelete.impact.taskCountPreserved} ${pendingDelete.impact.taskCountPreserved === 1 ? "Task" : "Tasks"} will be preserved.`,
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
