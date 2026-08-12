import {
  ChevronLeft,
  ChevronRight,
  ListTodo,
  LoaderCircle,
  Plus,
  Search,
} from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../../../lib/api";
import {
  createIndependentTask,
  deleteTask,
  getTasks,
  updateTask,
  updateTaskStatus,
  type CreateTaskInput,
  type Task,
  type TaskQuery,
  type TaskStatus,
  type UpdateTaskInput,
} from "../services/taskApi";
import { TaskCard } from "../components/TaskCard";

type StatusFilter =
  | ""
  | TaskStatus;

interface AppliedFilters {
  query: string;
  status: StatusFilter;
  deadlineFrom: string;
  deadlineTo: string;
}

const PAGE_SIZE = 20;

const EMPTY_FILTERS: AppliedFilters = {
  query: "",
  status: "",
  deadlineFrom: "",
  deadlineTo: "",
};

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong.";
}

export function TasksPage() {
  const navigate = useNavigate();

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
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    notice,
    setNotice,
  ] = useState<string | null>(
    null,
  );

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
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setErrorMessage(
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
  ) {
    const targetPage =
      Math.max(0, preferredPage);

    setIsLoading(true);

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
        setErrorMessage(null);
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
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
      throw error;
    } finally {
      setIsLoading(false);
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
      setErrorMessage(
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
    };

    setErrorMessage(null);
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
    setErrorMessage(null);
    setNotice(null);
    setIsLoading(true);
    setPage(0);
    setAppliedFilters({
      ...EMPTY_FILTERS,
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

    setErrorMessage(null);
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
    setErrorMessage(null);
    setNotice(null);

    try {
      await createIndependentTask(
        input,
      );

      setTitle("");
      setDescription("");
      setDeadline("");
      setNotice(
        "Independent Task created.",
      );

      await reloadPage(0);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
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
    setErrorMessage(null);
    setNotice(null);

    try {
      await updateTask(
        taskId,
        input,
      );

      /*
       * Title, description, or deadline changes may
       * make the Task enter or leave the active
       * search/deadline filter. Reload from Backend.
       */
      await reloadPage(page);

      setNotice(
        "Task updated.",
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
      throw error;
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
    setErrorMessage(null);
    setNotice(null);

    try {
      await updateTaskStatus(
        taskId,
        status,
      );

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
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
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
    setErrorMessage(null);
    setNotice(null);

    try {
      await deleteTask(taskId);

      await reloadPage(page);

      setNotice(
        "Task deleted. Its source Note and YouTube source were not deleted.",
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
      throw error;
    } finally {
      setIsMutating(false);
    }
  }

  const hasAppliedFilters =
    Boolean(
      appliedFilters.query ||
      appliedFilters.status ||
      appliedFilters
        .deadlineFrom ||
      appliedFilters.deadlineTo,
    );

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <header>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">
            Global workspace
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">
                Tasks
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                Manage Tasks across your account. Status and deadline changes are reflected by the same Task data used by Daily Plan, while source relationships remain unchanged.
              </p>
            </div>

            <p className="text-sm text-neutral-500">
              {totalElements} task
              {totalElements === 1
                ? ""
                : "s"}
            </p>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
          <div className="flex items-center gap-2">
            <Plus
              size={16}
              className="text-neutral-500"
              aria-hidden="true"
            />

            <div>
              <h2 className="text-sm font-medium text-neutral-300">
                Create independent Task
              </h2>

              <p className="mt-1 text-xs text-neutral-500">
                Tasks created here intentionally have no source. Create-from-Note remains a separate source-preserving flow.
              </p>
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
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="min-w-0 rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isMutating
                  ? "Saving..."
                  : "Create"}
              </button>
            </div>
          </div>
        </section>

        <form
          onSubmit={
            handleApplyFilters
          }
          className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4"
        >
          <div className="grid gap-2 lg:grid-cols-[1.4fr_0.8fr_1fr_1fr_auto]">
            <div className="flex min-w-0 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3 focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-700">
              <Search
                size={15}
                className="shrink-0 text-neutral-500"
                aria-hidden="true"
              />

              <label
                htmlFor="global-task-search"
                className="sr-only"
              >
                Search Tasks
              </label>

              <input
                id="global-task-search"
                value={searchText}
                disabled={isLoading}
                onChange={(event) =>
                  setSearchText(
                    event.target.value,
                  )
                }
                placeholder="Search title or description..."
                className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="global-task-status"
                className="sr-only"
              >
                Filter by status
              </label>

              <select
                id="global-task-status"
                value={statusFilter}
                disabled={isLoading}
                onChange={(event) =>
                  setStatusFilter(
                    event.target
                      .value as StatusFilter,
                  )
                }
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  All statuses
                </option>
                <option value="NOT_STARTED">
                  Not started
                </option>
                <option value="IN_PROGRESS">
                  In progress
                </option>
                <option value="COMPLETED">
                  Completed
                </option>
              </select>
            </div>

            <div>
              <label
                htmlFor="global-task-deadline-from"
                className="sr-only"
              >
                Deadline from
              </label>

              <input
                id="global-task-deadline-from"
                type="date"
                value={deadlineFrom}
                disabled={isLoading}
                onChange={(event) =>
                  setDeadlineFrom(
                    event.target.value,
                  )
                }
                title="Deadline from"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <div>
              <label
                htmlFor="global-task-deadline-to"
                className="sr-only"
              >
                Deadline to
              </label>

              <input
                id="global-task-deadline-to"
                type="date"
                value={deadlineTo}
                disabled={isLoading}
                onChange={(event) =>
                  setDeadlineTo(
                    event.target.value,
                  )
                }
                title="Deadline to"
                className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading && (
                <LoaderCircle
                  size={14}
                  className="animate-spin"
                  aria-hidden="true"
                />
              )}

              Apply
            </button>
          </div>

          {(searchText ||
            statusFilter ||
            deadlineFrom ||
            deadlineTo ||
            hasAppliedFilters) && (
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={isLoading}
                onClick={
                  handleClearFilters
                }
                className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear filters
              </button>
            </div>
          )}
        </form>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {notice && (
          <div
            role="status"
            className="mt-4 rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-300"
          >
            {notice}
          </div>
        )}

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900"
          >
            <div className="text-center">
              <LoaderCircle
                size={24}
                className="mx-auto animate-spin text-neutral-500"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm text-neutral-500">
                Loading Tasks...
              </p>
            </div>
          </div>
        ) : tasks.length === 0 ? (
          <div className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 p-6 text-center">
            <div>
              <ListTodo
                size={28}
                className="mx-auto text-neutral-700"
                aria-hidden="true"
              />

              <h2 className="mt-3 text-sm font-medium text-neutral-300">
                {hasAppliedFilters
                  ? "No matching Tasks"
                  : "No Tasks yet"}
              </h2>

              <p className="mt-2 max-w-md text-xs leading-5 text-neutral-500">
                {hasAppliedFilters
                  ? "No Task matches the current search and filter conditions."
                  : "Create an independent Task here, or create one from a Note to preserve source context."}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {tasks.map((task) => (
              <TaskCard
                key={task.id}
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
              />
            ))}
          </div>
        )}

        {!isLoading &&
          totalPages > 1 && (
            <nav
              aria-label="Tasks pagination"
              className="mt-6 flex items-center justify-between border-t border-neutral-800 pt-4"
            >
              <p className="text-xs text-neutral-500">
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
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
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