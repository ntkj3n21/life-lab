import {
  ChevronLeft,
  ChevronRight,
  ListTodo,
  LoaderCircle,
  Plus,
} from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../../../lib/api";
import { useCategoryStore } from "../../../stores/categoryStore";
import { useTagStore } from "../../../stores/tagStore";
import {
  TagManager,
  type TagManagerChange,
} from "../../media/components/TagManager";
import {
  CategoryManager,
  type CategoryManagerChange,
} from "../../organization/components/CategoryManager";
import {
  createIndependentTask,
  deleteTask,
  getTasks,
  updateTask,
  updateTaskOrganization,
  updateTaskStatus,
  type CreateTaskInput,
  type Task,
  type TaskQuery,
  type TaskSourceStatus,
  type TaskStatus,
  type UpdateTaskInput,
} from "../services/taskApi";
import { TaskCard } from "../components/TaskCard";
import { TaskFilters } from "../components/TaskFilters";
import { TaskOrganizationEditor } from "../components/TaskOrganizationEditor";

type StatusFilter =
  | ""
  | TaskStatus;

type SourceStatusFilter =
  | ""
  | TaskSourceStatus;

type TaskSortBy = NonNullable<
  TaskQuery["sortBy"]
>;

type TaskSortDirection =
  NonNullable<
    TaskQuery["sortDirection"]
  >;

interface AppliedFilters {
  query: string;
  status: StatusFilter;
  deadlineFrom: string;
  deadlineTo: string;
  categoryId?: number;
  tagIds: number[];
  sourceStatus: SourceStatusFilter;
  sortBy: TaskSortBy;
  sortDirection: TaskSortDirection;
}

const PAGE_SIZE = 20;

const EMPTY_FILTERS: AppliedFilters = {
  query: "",
  status: "",
  deadlineFrom: "",
  deadlineTo: "",
  tagIds: [],
  sourceStatus: "",
  sortBy: "createdAt",
  sortDirection: "desc",
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong.";
}

export function TasksPage() {
  const navigate = useNavigate();

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

  const [
    tasks,
    setTasks,
  ] = useState<Task[]>([]);

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
    statusFilter,
    setStatusFilter,
  ] =
    useState<StatusFilter>("");

  const [
    deadlineFrom,
    setDeadlineFrom,
  ] = useState("");

  const [
    deadlineTo,
    setDeadlineTo,
  ] = useState("");

  const [
    categoryId,
    setCategoryId,
  ] = useState<number | undefined>(
    undefined,
  );

  const [
    tagIds,
    setTagIds,
  ] = useState<number[]>([]);

  const [
    sourceStatusFilter,
    setSourceStatusFilter,
  ] = useState<SourceStatusFilter>(
    "",
  );

  const [
    sortBy,
    setSortBy,
  ] = useState<TaskSortBy>(
    "createdAt",
  );

  const [
    sortDirection,
    setSortDirection,
  ] = useState<TaskSortDirection>(
    "desc",
  );

  const [
    appliedFilters,
    setAppliedFilters,
  ] =
    useState<AppliedFilters>(
      EMPTY_FILTERS,
    );

  const [
    title,
    setTitle,
  ] = useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    deadline,
    setDeadline,
  ] = useState("");

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isMutating,
    setIsMutating,
  ] = useState(false);

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
    editingOrganizationTaskId,
    setEditingOrganizationTaskId,
  ] = useState<number | null>(
    null,
  );

  const [
    notice,
    setNotice,
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

  function buildQuery(
    targetPage: number,
    filters = appliedFilters,
  ): TaskQuery {
    return {
      page: targetPage,
      size: PAGE_SIZE,
      q:
        filters.query ||
        undefined,
      status:
        filters.status ||
        undefined,
      deadlineFrom:
        filters.deadlineFrom ||
        undefined,
      deadlineTo:
        filters.deadlineTo ||
        undefined,
      categoryId:
        filters.categoryId,
      tagIds:
        filters.tagIds.length > 0
          ? filters.tagIds
          : undefined,
      sourceStatus:
        filters.sourceStatus ||
        undefined,
      sortBy: filters.sortBy,
      sortDirection:
        filters.sortDirection,
    };
  }

  useEffect(() => {
    let cancelled = false;

    void getTasks({
      page,
      size: PAGE_SIZE,
      q:
        appliedFilters.query ||
        undefined,
      status:
        appliedFilters.status ||
        undefined,
      deadlineFrom:
        appliedFilters.deadlineFrom ||
        undefined,
      deadlineTo:
        appliedFilters.deadlineTo ||
        undefined,
      categoryId:
        appliedFilters.categoryId,
      tagIds:
        appliedFilters.tagIds
          .length > 0
          ? appliedFilters.tagIds
          : undefined,
      sourceStatus:
        appliedFilters.sourceStatus ||
        undefined,
      sortBy:
        appliedFilters.sortBy,
      sortDirection:
        appliedFilters.sortDirection,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setTasks(response.items);
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
    appliedFilters,
  ]);

  async function reloadPage(
    preferredPage: number,
    showLoading = true,
  ) {
    const targetPage =
      Math.max(0, preferredPage);

    if (showLoading) {
      setIsLoading(true);
    }
    setLoadErrorMessage(null);

    try {
      const response =
        await getTasks(
          buildQuery(targetPage),
        );

      const normalizedPage =
        response.totalPages === 0
          ? 0
          : Math.min(
              targetPage,
              response.totalPages - 1,
            );

      /*
       * A mutation can remove the final result from
       * the current filtered page. If the requested
       * page is no longer valid, load the new final
       * page instead of leaving "Page 2 of 1".
       */
      if (
        normalizedPage !==
        targetPage
      ) {
        const normalizedResponse =
          await getTasks(
            buildQuery(
              normalizedPage,
            ),
          );

        setTasks(
          normalizedResponse.items,
        );
        setPage(
          normalizedResponse.page,
        );
        setTotalElements(
          normalizedResponse.totalElements,
        );
        setTotalPages(
          normalizedResponse.totalPages,
        );
        setLoadErrorMessage(null);
        return;
      }

      setTasks(response.items);
      setPage(response.page);
      setTotalElements(
        response.totalElements,
      );
      setTotalPages(
        response.totalPages,
      );
      setLoadErrorMessage(null);
    } catch (error) {
      setLoadErrorMessage(
        getErrorMessage(error),
      );
      throw error;
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  }

  function handleApplyFilters(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      deadlineFrom &&
      deadlineTo &&
      deadlineFrom > deadlineTo
    ) {
      setActionErrorMessage(
        "Deadline from must be on or before deadline to.",
      );
      return;
    }

    const nextFilters = {
      query:
        searchText.trim(),
      status: statusFilter,
      deadlineFrom,
      deadlineTo,
      categoryId,
      tagIds,
      sourceStatus:
        sourceStatusFilter,
      sortBy,
      sortDirection,
    };

    setLoadErrorMessage(null);
    setActionErrorMessage(null);
    setOrganizationErrorMessage(null);
    setEditingOrganizationTaskId(null);
    setNotice(null);
    setIsLoading(true);
    setPage(0);
    setAppliedFilters(
      nextFilters,
    );
  }

  function handleClearFilters() {
    setSearchText("");
    setStatusFilter("");
    setDeadlineFrom("");
    setDeadlineTo("");
    setCategoryId(undefined);
    setTagIds([]);
    setSourceStatusFilter("");
    setSortBy("createdAt");
    setSortDirection("desc");
    setLoadErrorMessage(null);
    setActionErrorMessage(null);
    setOrganizationErrorMessage(null);
    setEditingOrganizationTaskId(null);
    setNotice(null);
    setIsLoading(true);
    setPage(0);
    setAppliedFilters({
      ...EMPTY_FILTERS,
      tagIds: [],
    });
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

    setLoadErrorMessage(null);
    setActionErrorMessage(null);
    setNotice(null);
    setIsLoading(true);
    setPage(nextPage);
  }

  async function handleCreateTask() {
    const trimmedTitle =
      title.trim();

    if (
      !trimmedTitle ||
      isMutating
    ) {
      return;
    }

    const input:
      CreateTaskInput = {
        title: trimmedTitle,
        description:
          description.trim() ||
          null,
        deadline:
          deadline || null,
      };

    setIsMutating(true);
    setActionErrorMessage(null);
    setNotice(null);

    try {
      await createIndependentTask(
        input,
      );
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
      setIsMutating(false);
      return;
    }

    setTitle("");
    setDescription("");
    setDeadline("");

    try {
      await reloadPage(0);
      setNotice(
        "Independent Task created.",
      );
    } catch {
      setLoadErrorMessage(
        "Task created, but the Task list could not be refreshed.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleUpdate(
    taskId: number,
    input: UpdateTaskInput,
  ) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setActionErrorMessage(null);
    setNotice(null);

    try {
      await updateTask(
        taskId,
        input,
      );

    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
      setIsMutating(false);
      throw error;
    }

    try {
      /*
       * Title, description, or deadline changes may
       * make the Task enter or leave the active
       * search/deadline filter. Reload from Backend.
       */
      await reloadPage(page);
      setNotice(
        "Task updated.",
      );
    } catch {
      setLoadErrorMessage(
        "Task updated, but the Task list could not be refreshed.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleStatusChange(
    taskId: number,
    status: TaskStatus,
  ) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setActionErrorMessage(null);
    setNotice(null);

    try {
      await updateTaskStatus(
        taskId,
        status,
      );

    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
      setIsMutating(false);
      return;
    }

    try {
      /*
       * Always reload from Backend. A status change
       * can make the Task leave an active status
       * filter, while other filters and pagination
       * must remain authoritative as well.
       */
      await reloadPage(page);
      setNotice(
        "Task status updated.",
      );
    } catch {
      setLoadErrorMessage(
        "Task status updated, but the Task list could not be refreshed.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDelete(
    taskId: number,
  ) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setActionErrorMessage(null);
    setNotice(null);

    try {
      await deleteTask(taskId);
    } catch (error) {
      setActionErrorMessage(
        getErrorMessage(error),
      );
      setIsMutating(false);
      throw error;
    }

    try {
      await reloadPage(page);
      setNotice("Task deleted.");
    } catch {
      setLoadErrorMessage(
        "Task deleted, but the Task list could not be refreshed.",
      );
    } finally {
      setIsMutating(false);
    }
  }

  function handleStartOrganizationEdit(
    task: Task,
  ) {
    setEditingOrganizationTaskId(
      task.id,
    );
    setOrganizationErrorMessage(null);
  }

  async function handleSaveOrganization(
    taskId: number,
    nextCategoryId: number | null,
    nextTagIds: number[],
  ) {
    if (isMutating) {
      return;
    }

    setIsMutating(true);
    setOrganizationErrorMessage(null);
    setNotice(null);

    try {
      const organization =
        await updateTaskOrganization(
          taskId,
          {
            categoryId:
              nextCategoryId,
            tagIds: nextTagIds,
          },
        );

      setTasks((current) =>
        current.map((task) =>
          task.id === taskId
            ? {
                ...task,
                category:
                  organization.category,
                tags:
                  organization.tags,
              }
            : task,
        ),
      );
      setEditingOrganizationTaskId(
        null,
      );

      try {
        await reloadPage(page, false);
        setNotice(
          "Task organization updated.",
        );
      } catch {
        setLoadErrorMessage(
          "Task organization updated, but the Task list could not be refreshed.",
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

  function refreshAfterCatalogChange() {
    setEditingOrganizationTaskId(null);

    void reloadPage(page, false).catch(
      () => {
        // reloadPage keeps the load error.
      },
    );
  }

  function handleCategoryChange(
    change: CategoryManagerChange,
  ) {
    if (change.type === "created") {
      return;
    }

    if (change.type === "renamed") {
      setTasks((current) =>
        current.map((task) =>
          task.category?.id ===
          change.category.id
            ? {
                ...task,
                category:
                  change.category,
              }
            : task,
        ),
      );
      refreshAfterCatalogChange();
      return;
    }

    setTasks((current) =>
      current.map((task) =>
        task.category?.id ===
        change.category.id
          ? {
              ...task,
              category: null,
            }
          : task,
      ),
    );

    const categoryWasSelected =
      categoryId ===
        change.category.id ||
      appliedFilters.categoryId ===
        change.category.id;

    if (categoryWasSelected) {
      const nextFilters = {
        ...appliedFilters,
        categoryId: undefined,
      };

      setCategoryId(undefined);
      setEditingOrganizationTaskId(null);
      setPage(0);
      setIsLoading(true);
      setAppliedFilters(nextFilters);
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
      setTasks((current) =>
        current.map((task) => ({
          ...task,
          tags: task.tags.map((tag) =>
            tag.id === change.tag.id
              ? change.tag
              : tag,
          ),
        })),
      );
      refreshAfterCatalogChange();
      return;
    }

    setTasks((current) =>
      current.map((task) => ({
        ...task,
        tags: task.tags.filter(
          (tag) =>
            tag.id !== change.tag.id,
        ),
      })),
    );

    const nextDraftTagIds =
      tagIds.filter(
        (tagId) =>
          tagId !== change.tag.id,
      );
    const nextAppliedTagIds =
      appliedFilters.tagIds.filter(
        (tagId) =>
          tagId !== change.tag.id,
      );
    const tagWasSelected =
      nextDraftTagIds.length !==
        tagIds.length ||
      nextAppliedTagIds.length !==
        appliedFilters.tagIds.length;

    if (tagWasSelected) {
      setTagIds(nextDraftTagIds);
      setEditingOrganizationTaskId(null);
      setPage(0);
      setIsLoading(true);
      setAppliedFilters({
        ...appliedFilters,
        tagIds: nextAppliedTagIds,
      });
      return;
    }

    refreshAfterCatalogChange();
  }

  const hasAppliedFilters =
    Boolean(
      appliedFilters.query ||
      appliedFilters.status ||
      appliedFilters
        .deadlineFrom ||
      appliedFilters.deadlineTo ||
      appliedFilters.categoryId !==
        undefined ||
      appliedFilters.tagIds.length > 0 ||
      appliedFilters.sourceStatus,
    );

  const hasChangedFilterControls =
    Boolean(
      searchText ||
      statusFilter ||
      deadlineFrom ||
      deadlineTo ||
      categoryId !== undefined ||
      tagIds.length > 0 ||
      sourceStatusFilter ||
      sortBy !== "createdAt" ||
      sortDirection !== "desc" ||
      hasAppliedFilters ||
      appliedFilters.sortBy !==
        "createdAt" ||
      appliedFilters.sortDirection !==
        "desc",
    );

  const organizationLoadError =
    (!hasLoadedCategories
      ? categoryError?.message
      : null) ??
    (!hasLoadedTags
      ? tagError?.message
      : null) ??
    null;

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header className="border-b border-(--border) pb-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">
                Tasks
              </h1>

              <p className="mt-1 max-w-2xl text-sm leading-6 text-(--text-secondary)">
                Turn learning context into clear, actionable work.
              </p>
            </div>

            <p className="w-fit rounded-full border border-(--border) bg-(--surface) px-3 py-1.5 text-xs font-medium text-(--text-secondary)">
              {totalElements}{" "}
              {hasAppliedFilters
                ? `result${totalElements === 1 ? "" : "s"}`
                : `task${totalElements === 1 ? "" : "s"}`}
            </p>
          </div>
        </header>

        <section className="mt-5 rounded-xl border border-(--border) bg-(--app-bg) p-4">
          <div className="flex items-center gap-2">
            <Plus
              size={16}
              className="text-(--text-muted)"
              aria-hidden="true"
            />

            <div>
              <h2 className="text-sm font-medium text-(--text-secondary)">
                Create independent Task
              </h2>

            </div>
          </div>

          <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_1.2fr_auto]">
            <div>
              <label
                htmlFor="global-task-title"
                className="sr-only"
              >
                Task title
              </label>

              <input
                id="global-task-title"
                value={title}
                maxLength={255}
                disabled={isMutating}
                onChange={(event) =>
                  setTitle(
                    event.target.value,
                  )
                }
                placeholder="Task title"
                className="w-full rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="global-task-description"
                className="sr-only"
              >
                Task description
              </label>

              <input
                id="global-task-description"
                value={description}
                disabled={isMutating}
                onChange={(event) =>
                  setDescription(
                    event.target.value,
                  )
                }
                placeholder="Description (optional)"
                className="w-full rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div className="flex gap-2">
              <label
                htmlFor="global-task-deadline"
                className="sr-only"
              >
                Task deadline
              </label>

              <input
                id="global-task-deadline"
                type="date"
                value={deadline}
                disabled={isMutating}
                onChange={(event) =>
                  setDeadline(
                    event.target.value,
                  )
                }
                className="min-w-0 rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5 text-sm text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
              />

              <button
                type="button"
                disabled={
                  isMutating ||
                  !title.trim()
                }
                onClick={() =>
                  void handleCreateTask()
                }
                className="shrink-0 rounded-xl bg-(--primary-bg) px-4 py-2.5 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMutating
                  ? "Saving..."
                  : "Create"}
              </button>
            </div>
          </div>
        </section>

        <TaskFilters
          searchText={searchText}
          status={statusFilter}
          deadlineFrom={deadlineFrom}
          deadlineTo={deadlineTo}
          categoryId={categoryId}
          tagIds={tagIds}
          sourceStatus={
            sourceStatusFilter
          }
          sortBy={sortBy}
          sortDirection={sortDirection}
          categories={categories}
          tags={tags}
          categoriesLoading={
            categoriesLoading
          }
          tagsLoading={tagsLoading}
          isLoading={isLoading}
          canClear={
            hasChangedFilterControls
          }
          onSearchTextChange={
            setSearchText
          }
          onStatusChange={
            setStatusFilter
          }
          onDeadlineFromChange={
            setDeadlineFrom
          }
          onDeadlineToChange={
            setDeadlineTo
          }
          onCategoryChange={
            setCategoryId
          }
          onTagIdsChange={setTagIds}
          onSourceStatusChange={
            setSourceStatusFilter
          }
          onSortByChange={setSortBy}
          onSortDirectionChange={
            setSortDirection
          }
          onApply={handleApplyFilters}
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

        {notice && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-(--border) bg-(--surface) px-4 py-3 text-sm text-(--text-secondary)"
          >
            {notice}
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
                Loading Tasks...
              </p>
            </div>
          </div>
        ) : loadErrorMessage ? null : tasks.length === 0 ? (
          <div className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-(--border) bg-(--app-bg) p-6 text-center">
            <div>
              <ListTodo
                size={28}
                className="mx-auto text-(--text-faint)"
                aria-hidden="true"
              />

              <h2 className="mt-3 text-sm font-medium text-(--text-secondary)">
                {hasAppliedFilters
                  ? "No matching Tasks"
                  : "No Tasks yet"}
              </h2>

              <p className="mt-2 max-w-md text-xs leading-5 text-(--text-muted)">
                {hasAppliedFilters
                  ? "No Task matches the current search and filter conditions."
                  : "Create an independent Task here, or create one from a Note to preserve source context."}
              </p>

              {hasAppliedFilters && (
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
            {tasks.map((task) => (
              <div key={task.id}>
                <TaskCard
                  task={task}
                  isMutating={
                    isMutating
                  }
                  onUpdate={
                    handleUpdate
                  }
                  onStatusChange={
                    handleStatusChange
                  }
                  onDelete={
                    handleDelete
                  }
                  onOpenDetail={(
                    taskId,
                  ) =>
                    navigate(
                      `/tasks/${taskId}`,
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
                />

                {editingOrganizationTaskId ===
                  task.id && (
                  <TaskOrganizationEditor
                    key={`organization-${task.id}`}
                    task={task}
                    categories={categories}
                    tags={tags}
                    isBusy={isMutating}
                    errorMessage={
                      organizationErrorMessage
                    }
                    onSave={(
                      nextCategoryId,
                      nextTagIds,
                    ) =>
                      handleSaveOrganization(
                        task.id,
                        nextCategoryId,
                        nextTagIds,
                      )
                    }
                    onCancel={() => {
                      if (!isMutating) {
                        setEditingOrganizationTaskId(
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
          !loadErrorMessage &&
          totalPages > 1 && (
            <nav
              aria-label="Tasks pagination"
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
                  aria-label="Previous Tasks page"
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
                  aria-label="Next Tasks page"
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
    </main>
  );
}
