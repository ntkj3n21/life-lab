import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  StickyNote,
} from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import {
  ApiError,
} from "../../../lib/api";
import { useCategoryStore } from "../../../stores/categoryStore";
import { useLayoutStore } from "../../../stores/layoutStore";
import { useTagStore } from "../../../stores/tagStore";
import { useWorkspaceStore } from "../../../stores/workspaceStore";
import {
  useReverseContextNavigation,
} from "../../context/hooks/useReverseContextNavigation";
import {
  TagManager,
  type TagManagerChange,
} from "../../media/components/TagManager";
import {
  CategoryManager,
  type CategoryManagerChange,
} from "../../organization/components/CategoryManager";
import {
  deleteNote as deleteNoteRequest,
  getNoteDeleteImpact,
  getNoteSourceRecordLabel,
  getNotes,
  updateNote as updateNoteRequest,
  updateNoteOrganization,
  type Note,
  type NoteDeleteImpact,
  type NoteQuery,
} from "../services/noteApi";
import { NoteCard } from "../components/NoteCard";
import { NoteFilters } from "../components/NoteFilters";
import { NoteOrganizationEditor } from "../components/NoteOrganizationEditor";

interface PendingNoteDelete {
  note: Note;
  impact: NoteDeleteImpact;
}

const PAGE_SIZE = 20;

type NoteSortBy = NonNullable<
  NoteQuery["sortBy"]
>;

type NoteSortDirection =
  NonNullable<
    NoteQuery["sortDirection"]
  >;

interface AppliedNoteFilters {
  categoryId?: number;
  tagIds: number[];
  hasTimestamp?: boolean;
  sortBy: NoteSortBy;
  sortDirection: NoteSortDirection;
}

const DEFAULT_FILTERS: AppliedNoteFilters = {
  tagIds: [],
  sortBy: "createdAt",
  sortDirection: "desc",
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong.";
}

export function NotesPage() {
  const navigate = useNavigate();

  const {
    openNoteContext,
  } =
    useReverseContextNavigation();

  const openRightPanel =
    useLayoutStore(
      (state) =>
        state.openRightPanel,
    );

  const beginTaskFromNote =
    useWorkspaceStore(
      (state) =>
        state.beginTaskFromNote,
    );

  const categories =
    useCategoryStore(
      (state) => state.categories,
    );

  const loadCategories =
    useCategoryStore(
      (state) =>
        state.loadCategories,
    );

  const categoriesLoading =
    useCategoryStore(
      (state) => state.isLoading,
    );

  const hasLoadedCategories =
    useCategoryStore(
      (state) =>
        state.hasLoadedCategories,
    );

  const categoryError =
    useCategoryStore(
      (state) => state.error,
    );

  const tags = useTagStore(
    (state) => state.tags,
  );

  const loadTags = useTagStore(
    (state) => state.loadTags,
  );

  const tagsLoading = useTagStore(
    (state) => state.isLoading,
  );

  const hasLoadedTags = useTagStore(
    (state) => state.hasLoadedTags,
  );

  const tagError = useTagStore(
    (state) => state.error,
  );

  const createTaskResolutionInFlightRef =
    useRef(false);

  const [
    notes,
    setNotes,
  ] = useState<Note[]>([]);

  const [
    page,
    setPage,
  ] = useState(0);

  const [
    totalElements,
    setTotalElements,
  ] = useState(0);

  const [
    totalPages,
    setTotalPages,
  ] = useState(0);

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    appliedQuery,
    setAppliedQuery,
  ] = useState("");

  const [
    filters,
    setFilters,
  ] = useState<AppliedNoteFilters>(
    DEFAULT_FILTERS,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isMutating,
    setIsMutating,
  ] = useState(false);

  const [
    preparingTaskNoteId,
    setPreparingTaskNoteId,
  ] = useState<number | null>(
    null,
  );

  const [
    loadErrorMessage,
    setLoadErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    actionErrorMessage,
    setActionErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    organizationErrorMessage,
    setOrganizationErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    editingNoteId,
    setEditingNoteId,
  ] = useState<number | null>(
    null,
  );

  const [
    editingContent,
    setEditingContent,
  ] = useState("");

  const [
    editingOrganizationNoteId,
    setEditingOrganizationNoteId,
  ] = useState<number | null>(
    null,
  );

  const [
    pendingDelete,
    setPendingDelete,
  ] =
    useState<PendingNoteDelete | null>(
      null,
    );

  const [
    deleteErrorMessage,
    setDeleteErrorMessage,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    void loadCategories().catch(() => {
      // categoryStore keeps error.
    });

    void loadTags().catch(() => {
      // tagStore keeps error.
    });
  }, [
    loadCategories,
    loadTags,
  ]);

  useEffect(() => {
    let cancelled = false;

    void getNotes({
      page,
      size: PAGE_SIZE,
      q:
        appliedQuery ||
        undefined,
      categoryId:
        filters.categoryId,
      tagIds:
        filters.tagIds.length > 0
          ? filters.tagIds
          : undefined,
      hasTimestamp:
        filters.hasTimestamp,
      sortBy: filters.sortBy,
      sortDirection:
        filters.sortDirection,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setNotes(response.items);
        setTotalElements(
          response.totalElements,
        );
        setTotalPages(
          response.totalPages,
        );
        setLoadErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setLoadErrorMessage(
          getErrorMessage(error),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    page,
    appliedQuery,
    filters.categoryId,
    filters.tagIds,
    filters.hasTimestamp,
    filters.sortBy,
    filters.sortDirection,
  ]);

  function buildNoteQuery(
    targetPage: number,
    targetFilters = filters,
    targetSearch = appliedQuery,
  ): NoteQuery {
    return {
      page: targetPage,
      size: PAGE_SIZE,
      q:
        targetSearch ||
        undefined,
      categoryId:
        targetFilters.categoryId,
      tagIds:
        targetFilters.tagIds
          .length > 0
          ? targetFilters.tagIds
          : undefined,
      hasTimestamp:
        targetFilters.hasTimestamp,
      sortBy:
        targetFilters.sortBy,
      sortDirection:
        targetFilters.sortDirection,
    };
  }

  async function reloadNotesAfterMutation(
    preferredPage: number,
  ) {
    const targetPage =
      Math.max(0, preferredPage);

    const response =
      await getNotes(
        buildNoteQuery(
          targetPage,
        ),
      );

    const normalizedPage =
      response.totalPages === 0
        ? 0
        : Math.min(
            targetPage,
            response.totalPages - 1,
          );

    /*
     * Editing can make a Note leave the current
     * search result, and deletion can remove the
     * final item from the final page. When the
     * current page becomes invalid, move to the
     * new last page and let the normal effect load
     * that page exactly once.
     */
    if (
      normalizedPage !==
      targetPage
    ) {
      setIsLoading(true);
      setPage(normalizedPage);
      return;
    }

    setNotes(response.items);
    setTotalElements(
      response.totalElements,
    );
    setTotalPages(
      response.totalPages,
    );
  }

  async function reloadNotesOnDemand(
    targetPage: number,
    targetFilters = filters,
    targetSearch = appliedQuery,
  ) {
    setIsLoading(true);
    setLoadErrorMessage(null);

    try {
      const response =
        await getNotes(
          buildNoteQuery(
            targetPage,
            targetFilters,
            targetSearch,
          ),
        );

      setNotes(response.items);
      setTotalElements(
        response.totalElements,
      );
      setTotalPages(
        response.totalPages,
      );
    } catch (error) {
      setLoadErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function applyFilterChange(
    nextFilters: AppliedNoteFilters,
  ) {
    setLoadErrorMessage(null);
    setActionErrorMessage(null);
    setOrganizationErrorMessage(null);
    setEditingOrganizationNoteId(null);
    setIsLoading(true);
    setPage(0);
    setFilters(nextFilters);
  }

  function handleSearchSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const nextQuery =
      searchText.trim();

    setLoadErrorMessage(null);
    setActionErrorMessage(null);

    /*
     * React does not rerun the data-loading effect
     * when both page and appliedQuery keep the same
     * values. Reload explicitly in that case instead
     * of setting isLoading and leaving the page stuck.
     */
    if (
      page === 0 &&
      nextQuery === appliedQuery
    ) {
      void reloadNotesOnDemand(
        0,
        filters,
        nextQuery,
      );
      return;
    }

    setIsLoading(true);

    setPage(0);
    setAppliedQuery(nextQuery);
  }

  function handleClearFilters() {
    const appliedAlreadyClear =
      !appliedQuery &&
      filters.categoryId ===
        undefined &&
      filters.tagIds.length === 0 &&
      filters.hasTimestamp ===
        undefined &&
      filters.sortBy ===
        DEFAULT_FILTERS.sortBy &&
      filters.sortDirection ===
        DEFAULT_FILTERS.sortDirection;

    setSearchText("");
    setLoadErrorMessage(null);
    setActionErrorMessage(null);
    setOrganizationErrorMessage(null);
    setEditingOrganizationNoteId(null);

    if (
      appliedAlreadyClear &&
      page === 0
    ) {
      return;
    }

    setIsLoading(true);
    setPage(0);
    setAppliedQuery("");
    setFilters(DEFAULT_FILTERS);
  }

  function handlePageChange(
    nextPage: number,
  ) {
    if (
      isLoading ||
      nextPage < 0 ||
      nextPage >= totalPages ||
      nextPage === page
    ) {
      return;
    }

    setIsLoading(true);
    setLoadErrorMessage(null);
    setActionErrorMessage(null);
    setPage(nextPage);
  }

  function handleStartEdit(
    note: Note,
  ) {
    setEditingOrganizationNoteId(
      null,
    );
    setEditingNoteId(note.id);
    setEditingContent(
      note.content,
    );
    setActionErrorMessage(null);
  }

  function handleCancelEdit() {
    setEditingNoteId(null);
    setEditingContent("");
  }

  async function handleSaveEdit(
    noteId: number,
  ) {
    const content =
      editingContent.trim();

    if (
      isMutating ||
      !content
    ) {
      return;
    }

    setIsMutating(true);
    setActionErrorMessage(null);

    try {
      await updateNoteRequest(
        noteId,
        {
          content,
        },
      );

      setEditingNoteId(null);
      setEditingContent("");
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
      setIsMutating(false);
      return;
    }

    try {
      await reloadNotesAfterMutation(
        page,
      );
      setLoadErrorMessage(null);
    } catch (error) {
      setLoadErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  function handleStartOrganizationEdit(
    note: Note,
  ) {
    handleCancelEdit();
    setEditingOrganizationNoteId(
      note.id,
    );
    setOrganizationErrorMessage(null);
  }

  async function handleSaveOrganization(
    noteId: number,
    categoryId: number | null,
    tagIds: number[],
  ) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setOrganizationErrorMessage(null);

    try {
      const organization =
        await updateNoteOrganization(
          noteId,
          {
            categoryId,
            tagIds,
          },
        );

      setNotes((current) =>
        current.map((note) =>
          note.id === noteId
            ? {
                ...note,
                category:
                  organization.category,
                tags:
                  organization.tags,
              }
            : note,
        ),
      );
      setEditingOrganizationNoteId(
        null,
      );

      try {
        await reloadNotesAfterMutation(
          page,
        );
        setLoadErrorMessage(null);
      } catch (error) {
        setLoadErrorMessage(
          getErrorMessage(error),
        );
      }
    } catch (error) {
      setOrganizationErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRequestDelete(
    note: Note,
  ) {
    if (isMutating) {
      return;
    }

    setActionErrorMessage(null);
    setDeleteErrorMessage(null);

    try {
      const impact =
        await getNoteDeleteImpact(
          note.id,
        );

      setPendingDelete({
        note,
        impact,
      });
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
    }
  }

  async function handleConfirmDelete() {
    if (
      !pendingDelete ||
      isMutating
    ) {
      return;
    }

    setIsMutating(true);
    setDeleteErrorMessage(null);
    setActionErrorMessage(null);

    try {
      await deleteNoteRequest(
        pendingDelete.note.id,
      );

      if (
        editingNoteId ===
        pendingDelete.note.id
      ) {
        handleCancelEdit();
      }

      if (
        editingOrganizationNoteId ===
        pendingDelete.note.id
      ) {
        setEditingOrganizationNoteId(
          null,
        );
      }

      setPendingDelete(null);

      try {
        await reloadNotesAfterMutation(
          page,
        );
      } catch (error) {
        /*
         * The Note is already deleted at this point.
         * Report a list-refresh problem globally
         * instead of reopening a destructive action.
         */
        setLoadErrorMessage(
          getErrorMessage(error),
        );
      }
    } catch (error) {
      setDeleteErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleViewSource(
    noteId: number,
  ) {
    setActionErrorMessage(null);

    try {
      await openNoteContext(
        noteId,
      );
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
    }
  }

  async function handleCreateTask(
    note: Note,
  ) {
    if (
      createTaskResolutionInFlightRef.current
    ) {
      return;
    }

    createTaskResolutionInFlightRef.current =
      true;
    setPreparingTaskNoteId(note.id);
    setActionErrorMessage(null);

    try {
      const resolution =
        await openNoteContext(
          note.id,
        );

      if (
        resolution.navigationMode !==
        "WORKSPACE"
      ) {
        return;
      }

      beginTaskFromNote(note);
      openRightPanel("tools");
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      createTaskResolutionInFlightRef.current =
        false;
      setPreparingTaskNoteId(null);
    }
  }

  function refreshAfterCatalogChange() {
    setEditingOrganizationNoteId(null);

    void reloadNotesAfterMutation(page)
      .then(() => {
        setLoadErrorMessage(null);
      })
      .catch((error: unknown) => {
        setLoadErrorMessage(
          getErrorMessage(error),
        );
      });
  }

  function handleCategoryChange(
    change: CategoryManagerChange,
  ) {
    if (change.type === "created") {
      return;
    }

    if (change.type === "renamed") {
      setNotes((current) =>
        current.map((note) =>
          note.category?.id ===
          change.category.id
            ? {
                ...note,
                category:
                  change.category,
              }
            : note,
        ),
      );
      refreshAfterCatalogChange();
      return;
    }

    setNotes((current) =>
      current.map((note) =>
        note.category?.id ===
        change.category.id
          ? {
              ...note,
              category: null,
            }
          : note,
      ),
    );

    if (
      filters.categoryId ===
      change.category.id
    ) {
      applyFilterChange({
        ...filters,
        categoryId: undefined,
      });
      return;
    }

    refreshAfterCatalogChange();
  }

  function handleTagChange(
    change: TagManagerChange,
  ) {
    if (change.type === "created") {
      return;
    }

    if (change.type === "renamed") {
      setNotes((current) =>
        current.map((note) => ({
          ...note,
          tags: note.tags.map((tag) =>
            tag.id === change.tag.id
              ? change.tag
              : tag,
          ),
        })),
      );
      refreshAfterCatalogChange();
      return;
    }

    setNotes((current) =>
      current.map((note) => ({
        ...note,
        tags: note.tags.filter(
          (tag) =>
            tag.id !== change.tag.id,
        ),
      })),
    );

    if (
      filters.tagIds.includes(
        change.tag.id,
      )
    ) {
      applyFilterChange({
        ...filters,
        tagIds:
          filters.tagIds.filter(
            (tagId) =>
              tagId !== change.tag.id,
          ),
      });
      return;
    }

    refreshAfterCatalogChange();
  }

  const hasResultFilters = Boolean(
    appliedQuery ||
      filters.categoryId !==
        undefined ||
      filters.tagIds.length > 0 ||
      filters.hasTimestamp !==
        undefined,
  );

  const hasChangedControls = Boolean(
    hasResultFilters ||
      searchText ||
      filters.sortBy !==
        DEFAULT_FILTERS.sortBy ||
      filters.sortDirection !==
        DEFAULT_FILTERS.sortDirection,
  );

  const organizationLoadError =
    (!hasLoadedCategories
      ? categoryError?.message
      : null) ??
    (!hasLoadedTags
      ? tagError?.message
      : null) ??
    null;

  const deleteDetails =
    pendingDelete
      ? [
          `${pendingDelete.impact.taskCountToMarkSourceMissing} linked task(s) will remain, but will no longer be linked to this Note.`,
          pendingDelete.impact.sourcePreserved
            ? `The exact ${getNoteSourceRecordLabel(pendingDelete.note)} source record will be preserved.`
            : `The ${getNoteSourceRecordLabel(pendingDelete.note)} source will not be preserved.`,
          pendingDelete.impact.tasksPreserved
            ? "Linked Tasks are preserved."
            : "Linked Tasks are not preserved.",
        ]
      : [];

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <header className="border-b border-(--border) pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">
                Notes
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-(--text-secondary)">
                Capture and revisit learning context without losing its source.
              </p>
            </div>

            <p className="w-fit rounded-full border border-(--border) bg-(--surface) px-3 py-1.5 text-xs font-medium text-(--text-secondary)">
              {totalElements}{" "}
              {hasResultFilters
                ? `result${totalElements === 1 ? "" : "s"}`
                : `note${totalElements === 1 ? "" : "s"}`}
            </p>
          </div>
        </header>

        <NoteFilters
          searchText={searchText}
          categoryId={
            filters.categoryId
          }
          tagIds={filters.tagIds}
          hasTimestamp={
            filters.hasTimestamp
          }
          sortBy={filters.sortBy}
          sortDirection={
            filters.sortDirection
          }
          categories={categories}
          tags={tags}
          categoriesLoading={
            categoriesLoading
          }
          tagsLoading={tagsLoading}
          isLoading={isLoading}
          canClear={hasChangedControls}
          onSearchTextChange={
            setSearchText
          }
          onSearch={handleSearchSubmit}
          onCategoryChange={(
            categoryId,
          ) =>
            applyFilterChange({
              ...filters,
              categoryId,
            })
          }
          onTagIdsChange={(tagIds) =>
            applyFilterChange({
              ...filters,
              tagIds,
            })
          }
          onTimestampChange={(
            hasTimestamp,
          ) =>
            applyFilterChange({
              ...filters,
              hasTimestamp,
            })
          }
          onSortByChange={(sortBy) =>
            applyFilterChange({
              ...filters,
              sortBy,
            })
          }
          onSortDirectionChange={(
            sortDirection,
          ) =>
            applyFilterChange({
              ...filters,
              sortDirection,
            })
          }
          onClear={handleClearFilters}
        />

        {organizationLoadError && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) px-4 py-3 text-sm text-(--danger-text)"
          >
            Organization options could not be loaded: {organizationLoadError}
          </div>
        )}

        <details className="mt-4 rounded-xl border border-(--border) bg-(--surface)">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-(--text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)">
            Manage categories and tags
          </summary>
          <div className="grid gap-3 border-t border-(--border) p-3 md:grid-cols-2">
            <CategoryManager
              onChange={
                handleCategoryChange
              }
            />
            <TagManager
              onChange={handleTagChange}
            />
          </div>
        </details>

        {loadErrorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) px-4 py-3 text-sm text-(--danger-text)"
          >
            {loadErrorMessage}
          </div>
        )}

        {actionErrorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-(--danger-border) bg-(--danger-surface) px-4 py-3 text-sm text-(--danger-text)"
          >
            {actionErrorMessage}
          </div>
        )}

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-(--border) bg-(--surface)"
          >
            <div className="text-center">
              <LoaderCircle
                size={24}
                className="mx-auto animate-spin text-(--text-muted)"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm text-(--text-muted)">
                Loading Notes...
              </p>
            </div>
          </div>
        ) : loadErrorMessage ? null : notes.length === 0 ? (
          <div className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-(--border) bg-(--app-bg) p-6 text-center">
            <div>
              <StickyNote
                size={28}
                className="mx-auto text-(--text-faint)"
                aria-hidden="true"
              />

              <h2 className="mt-3 text-sm font-medium text-(--text-secondary)">
                {hasResultFilters
                  ? "No matching Notes"
                  : "No Notes yet"}
              </h2>

              <p className="mt-2 max-w-md text-xs leading-5 text-(--text-muted)">
                {hasResultFilters
                  ? "No Notes match the current server-side filters. Change or clear the filter conditions."
                  : "Notes created from a Video Workspace will appear here."}
              </p>

              {hasResultFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-4 rounded-xl border border-(--border) bg-(--surface) px-3 py-2 text-xs font-medium text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {notes.map((note) => (
              <div key={note.id}>
                <NoteCard
                  note={note}
                  current={false}
                  isMutating={
                    isMutating
                  }
                  isEditing={
                    editingNoteId ===
                    note.id
                  }
                  editingContent={
                    editingNoteId ===
                    note.id
                      ? editingContent
                      : ""
                  }
                  onEditingContentChange={
                    setEditingContent
                  }
                  onStartEdit={
                    handleStartEdit
                  }
                  onCancelEdit={
                    handleCancelEdit
                  }
                  onSaveEdit={
                    handleSaveEdit
                  }
                  onDelete={
                    handleRequestDelete
                  }
                  onViewSource={
                    handleViewSource
                  }
                  onCreateTask={(selectedNote) =>
                    void handleCreateTask(
                      selectedNote,
                    )
                  }
                  onEditOrganization={
                    handleStartOrganizationEdit
                  }
                  isOrganizationDisabled={
                    categoriesLoading ||
                    tagsLoading ||
                    Boolean(
                      organizationLoadError,
                    )
                  }
                  isCreatingTask={
                    preparingTaskNoteId ===
                    note.id
                  }
                  isCreateTaskDisabled={
                    preparingTaskNoteId !==
                    null
                  }
                  onOpenDetail={(
                    noteId,
                  ) =>
                    navigate(
                      `/notes/${noteId}`,
                    )
                  }
                />

                {editingOrganizationNoteId ===
                  note.id && (
                  <NoteOrganizationEditor
                    key={`organization-${note.id}`}
                    note={note}
                    categories={categories}
                    tags={tags}
                    isBusy={isMutating}
                    errorMessage={
                      organizationErrorMessage
                    }
                    onSave={(
                      categoryId,
                      tagIds,
                    ) =>
                      handleSaveOrganization(
                        note.id,
                        categoryId,
                        tagIds,
                      )
                    }
                    onCancel={() => {
                      if (!isMutating) {
                        setEditingOrganizationNoteId(
                          null,
                        );
                        setOrganizationErrorMessage(
                          null,
                        );
                      }
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {!isLoading &&
          totalPages > 1 && (
            <nav
              aria-label="Notes pagination"
              className="mt-6 flex items-center justify-between border-t border-(--border) pt-4"
            >
              <p className="text-xs text-(--text-muted)">
                Page {page + 1} of{" "}
                {totalPages}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    page <= 0 ||
                    isLoading
                  }
                  onClick={() =>
                    handlePageChange(
                      page - 1,
                    )
                  }
                  aria-label="Previous Notes page"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--border) text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft
                    size={16}
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  disabled={
                    page + 1 >=
                      totalPages ||
                    isLoading
                  }
                  onClick={() =>
                    handlePageChange(
                      page + 1,
                    )
                  }
                  aria-label="Next Notes page"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--border) text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </nav>
          )}
      </div>

      <ConfirmDialog
        open={
          pendingDelete !==
          null
        }
        title="Delete this Note?"
        description="This removes the Note itself. Life Lab preserves historical source integrity according to the Note deletion rules."
        details={deleteDetails}
        confirmLabel="Delete Note"
        isBusy={isMutating}
        errorMessage={
          deleteErrorMessage
        }
        onCancel={() => {
          if (isMutating) {
            return;
          }

          setPendingDelete(null);
          setDeleteErrorMessage(
            null,
          );
        }}
        onConfirm={
          handleConfirmDelete
        }
      />
    </main>
  );
}
