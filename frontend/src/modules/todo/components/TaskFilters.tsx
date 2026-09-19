import {
  LoaderCircle,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  type FormEvent,
  useId,
  useRef,
  useState,
} from "react";

import { FilterDialogShell } from "../../../components/ui/FilterDialogShell";
import type { Tag } from "../../media/services/tagApi";
import type { Category } from "../../organization/services/categoryApi";
import type {
  TaskSourceStatus,
  TaskStatus,
} from "../services/taskApi";

interface TaskFilterSnapshot {
  status: "" | TaskStatus;
  deadlineFrom: string;
  deadlineTo: string;
  categoryId?: number;
  tagIds: number[];
  sourceStatus: "" | TaskSourceStatus;
  sortBy:
    | "createdAt"
    | "updatedAt"
    | "deadline";
  sortDirection: "asc" | "desc";
}

interface TaskFiltersProps {
  searchText: string;
  status: "" | TaskStatus;
  deadlineFrom: string;
  deadlineTo: string;
  categoryId?: number;
  tagIds: number[];
  sourceStatus: "" | TaskSourceStatus;
  sortBy:
    | "createdAt"
    | "updatedAt"
    | "deadline";
  sortDirection: "asc" | "desc";
  categories: Category[];
  tags: Tag[];
  categoriesLoading: boolean;
  tagsLoading: boolean;
  isLoading: boolean;
  canClear: boolean;

  onSearchTextChange: (
    value: string,
  ) => void;

  onStatusChange: (
    status: "" | TaskStatus,
  ) => void;

  onDeadlineFromChange: (
    value: string,
  ) => void;

  onDeadlineToChange: (
    value: string,
  ) => void;

  onCategoryChange: (
    categoryId: number | undefined,
  ) => void;

  onTagIdsChange: (
    tagIds: number[],
  ) => void;

  onSourceStatusChange: (
    sourceStatus:
      | ""
      | TaskSourceStatus,
  ) => void;

  onSortByChange: (
    sortBy:
      | "createdAt"
      | "updatedAt"
      | "deadline",
  ) => void;

  onSortDirectionChange: (
    sortDirection: "asc" | "desc",
  ) => void;

  onApply: (
    event: FormEvent<HTMLFormElement>,
  ) => void;

  onClear: () => void;
}

const inputClassName =
  "min-h-10 w-full rounded-lg border border-(--border) bg-(--app-bg) px-3 text-sm text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50";

export function TaskFilters({
  searchText,
  status,
  deadlineFrom,
  deadlineTo,
  categoryId,
  tagIds,
  sourceStatus,
  sortBy,
  sortDirection,
  categories,
  tags,
  categoriesLoading,
  tagsLoading,
  isLoading,
  canClear,
  onSearchTextChange,
  onStatusChange,
  onDeadlineFromChange,
  onDeadlineToChange,
  onCategoryChange,
  onTagIdsChange,
  onSourceStatusChange,
  onSortByChange,
  onSortDirectionChange,
  onApply,
}: TaskFiltersProps) {
  const dialogId = useId();

  const [
    showFilters,
    setShowFilters,
  ] = useState(false);

  const snapshotRef =
    useRef<TaskFilterSnapshot | null>(
      null,
    );

  const deadlineInvalid = Boolean(
    deadlineFrom &&
      deadlineTo &&
      deadlineFrom > deadlineTo,
  );

  function handleOpenFilters() {
    snapshotRef.current = {
      status,
      deadlineFrom,
      deadlineTo,
      categoryId,
      tagIds: [...tagIds],
      sourceStatus,
      sortBy,
      sortDirection,
    };

    setShowFilters(true);
  }

  function restoreSnapshot() {
    const snapshot =
      snapshotRef.current;

    if (!snapshot) {
      return;
    }

    onStatusChange(
      snapshot.status,
    );

    onDeadlineFromChange(
      snapshot.deadlineFrom,
    );

    onDeadlineToChange(
      snapshot.deadlineTo,
    );

    onCategoryChange(
      snapshot.categoryId,
    );

    onTagIdsChange([
      ...snapshot.tagIds,
    ]);

    onSourceStatusChange(
      snapshot.sourceStatus,
    );

    onSortByChange(
      snapshot.sortBy,
    );

    onSortDirectionChange(
      snapshot.sortDirection,
    );
  }

  function handleDismissFilters() {
    if (isLoading) {
      return;
    }

    restoreSnapshot();
    snapshotRef.current = null;
    setShowFilters(false);
  }

  function handleResetDraft() {
    onStatusChange("");
    onDeadlineFromChange("");
    onDeadlineToChange("");
    onCategoryChange(undefined);
    onTagIdsChange([]);
    onSourceStatusChange("");
    onSortByChange("createdAt");
    onSortDirectionChange("desc");
  }

  function handleToggleTag(
    tagId: number,
  ) {
    onTagIdsChange(
      tagIds.includes(tagId)
        ? tagIds.filter(
            (currentTagId) =>
              currentTagId !== tagId,
          )
        : [
            ...tagIds,
            tagId,
          ],
    );
  }

  function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    if (
      showFilters &&
      deadlineInvalid
    ) {
      event.preventDefault();
      return;
    }

    if (showFilters) {
      snapshotRef.current = null;
      setShowFilters(false);
    }

    onApply(event);
  }

  const dialogFooter = (
    <>
      <button
        type="button"
        onClick={handleResetDraft}
        disabled={
          isLoading ||
          !canClear
        }
        className="min-h-10 rounded-lg px-3 py-2 text-sm text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
      >
        Reset
      </button>

      <div className="flex min-w-0 flex-1 justify-end gap-2">
        <button
          type="button"
          onClick={
            handleDismissFilters
          }
          disabled={isLoading}
          className="min-h-10 rounded-lg border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="submit"
          disabled={
            isLoading ||
            deadlineInvalid
          }
          className="flex min-h-10 min-w-32 items-center justify-center gap-2 rounded-lg bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && (
            <LoaderCircle
              size={15}
              className="animate-spin"
              aria-hidden="true"
            />
          )}

          {isLoading
            ? "Applying..."
            : "Apply filters"}
        </button>
      </div>
    </>
  );

  return (
    <form
      aria-label="Task filters"
      aria-busy={isLoading}
      onSubmit={handleSubmit}
      className="mt-4"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-(--border) bg-(--app-bg) px-3 transition focus-within:border-(--border-strong) focus-within:ring-2 focus-within:ring-(--focus)">
          <Search
            size={15}
            className="shrink-0 text-(--text-muted)"
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
              onSearchTextChange(
                event.target.value,
              )
            }
            placeholder="Search title or description..."
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-(--text-faint) disabled:cursor-not-allowed disabled:opacity-50"
          />

          {isLoading && (
            <LoaderCircle
              size={14}
              className="shrink-0 animate-spin text-(--text-muted)"
              aria-hidden="true"
            />
          )}
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="min-h-10 rounded-lg bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          Search
        </button>

        <button
          type="button"
          onClick={handleOpenFilters}
          disabled={isLoading}
          aria-haspopup="dialog"
          aria-expanded={
            showFilters
          }
          aria-controls={dialogId}
          className={`flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 ${
            showFilters
              ? "border-(--border-strong) bg-(--surface-active) text-(--text-primary)"
              : "border-(--border) text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary)"
          }`}
        >
          <SlidersHorizontal
            size={15}
            aria-hidden="true"
          />

          Filters
        </button>
      </div>

      <FilterDialogShell
        open={showFilters}
        dialogId={dialogId}
        title="Task filters"
        description="Refine the current Tasks results. Changes apply only when you confirm them."
        isBusy={isLoading}
        onDismiss={
          handleDismissFilters
        }
        closeAriaLabel="Close Task filters"
        maxWidthClassName="max-w-4xl"
        footer={dialogFooter}
      >
        {deadlineInvalid && (
          <p
            role="alert"
            className="rounded-xl border border-(--warning-border) bg-(--warning-surface) px-3 py-2 text-xs text-(--warning-text)"
          >
            Deadline from must be on or before deadline to.
          </p>
        )}

        <p className="text-xs font-medium text-(--text-secondary)">
          Primary filters
        </p>

        <div className="grid gap-3 md:grid-cols-3">
          <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
            <legend className="px-1 text-xs font-medium text-(--text-secondary)">
              Status
            </legend>

            <label
              htmlFor="global-task-status"
              className="mb-1.5 block text-[11px] font-medium text-(--text-muted)"
            >
              Task status
            </label>

            <select
              id="global-task-status"
              value={status}
              disabled={isLoading}
              onChange={(event) =>
                onStatusChange(
                  event.target
                    .value as
                    | ""
                    | TaskStatus,
                )
              }
              className={
                inputClassName
              }
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
          </fieldset>

          <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
            <legend className="px-1 text-xs font-medium text-(--text-secondary)">
              Source
            </legend>

            <label
              htmlFor="global-task-source-status"
              className="mb-1.5 block text-[11px] font-medium text-(--text-muted)"
            >
              Source status
            </label>

            <select
              id="global-task-source-status"
              value={sourceStatus}
              disabled={isLoading}
              onChange={(event) =>
                onSourceStatusChange(
                  event.target
                    .value as
                    | ""
                    | TaskSourceStatus,
                )
              }
              className={
                inputClassName
              }
            >
              <option value="">
                All sources
              </option>

              <option value="INDEPENDENT">
                Independent
              </option>

              <option value="HAS_SOURCE">
                Has source
              </option>

              <option value="SOURCE_MISSING">
                Source missing
              </option>
            </select>
          </fieldset>

          <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
            <legend className="px-1 text-xs font-medium text-(--text-secondary)">
              Organization
            </legend>

            <label
              htmlFor="global-task-category"
              className="mb-1.5 block text-[11px] font-medium text-(--text-muted)"
            >
              Category
            </label>

            <select
              id="global-task-category"
              value={
                categoryId ?? ""
              }
              disabled={
                isLoading ||
                categoriesLoading
              }
              onChange={(event) =>
                onCategoryChange(
                  event.target.value
                    ? Number(
                        event.target
                          .value,
                      )
                    : undefined,
                )
              }
              className={
                inputClassName
              }
            >
              <option value="">
                All categories
              </option>

              {categories.map(
                (category) => (
                  <option
                    key={
                      category.id
                    }
                    value={
                      category.id
                    }
                  >
                    {category.name}
                  </option>
                ),
              )}
            </select>
          </fieldset>
        </div>

        <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
          <legend className="px-1 text-xs font-medium text-(--text-secondary)">
            Personal tags
          </legend>

          {tagsLoading &&
          tags.length === 0 ? (
            <p className="text-xs text-(--text-muted)">
              Loading tags...
            </p>
          ) : tags.length === 0 ? (
            <p className="text-xs text-(--text-muted)">
              No tags available.
            </p>
          ) : (
            <>
              <div className="flex max-h-36 flex-wrap gap-2 overflow-y-auto">
                {tags.map((tag) => {
                  const checked =
                    tagIds.includes(
                      tag.id,
                    );

                  return (
                    <label
                      key={tag.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                        checked
                          ? "border-(--border-strong) bg-(--surface-hover) text-(--text-primary)"
                          : "border-(--border) bg-(--app-bg) text-(--text-muted) hover:text-(--text-secondary)"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={
                          checked
                        }
                        disabled={
                          isLoading
                        }
                        onChange={() =>
                          handleToggleTag(
                            tag.id,
                          )
                        }
                        className="h-4 w-4 accent-(--primary-bg)"
                      />

                      <span className="wrap-break-word">
                        {tag.name}
                      </span>
                    </label>
                  );
                })}
              </div>

              <p className="mt-2 text-[10px] leading-4 text-(--text-muted)">
                Multiple selected tags match Tasks with any selected tag.
              </p>
            </>
          )}
        </fieldset>

        <details className="group rounded-xl border border-(--border) bg-(--app-bg)">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-xs font-medium text-(--text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)">
            <span>
              More filters
            </span>

            <SlidersHorizontal
              size={14}
              className="text-(--text-muted)"
              aria-hidden="true"
            />
          </summary>

          <div className="grid gap-3 border-t border-(--border) p-3 lg:grid-cols-2">
            <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
              <legend className="px-1 text-xs font-medium text-(--text-secondary)">
                Deadline
              </legend>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="global-task-deadline-from"
                    className="mb-1 block text-[11px] font-medium text-(--text-muted)"
                  >
                    From
                  </label>

                  <input
                    id="global-task-deadline-from"
                    type="date"
                    value={
                      deadlineFrom
                    }
                    disabled={
                      isLoading
                    }
                    onChange={(
                      event,
                    ) =>
                      onDeadlineFromChange(
                        event.target
                          .value,
                      )
                    }
                    className={
                      inputClassName
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="global-task-deadline-to"
                    className="mb-1 block text-[11px] font-medium text-(--text-muted)"
                  >
                    To
                  </label>

                  <input
                    id="global-task-deadline-to"
                    type="date"
                    value={
                      deadlineTo
                    }
                    disabled={
                      isLoading
                    }
                    onChange={(
                      event,
                    ) =>
                      onDeadlineToChange(
                        event.target
                          .value,
                      )
                    }
                    className={
                      inputClassName
                    }
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
              <legend className="px-1 text-xs font-medium text-(--text-secondary)">
                Sort
              </legend>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="global-task-sort"
                    className="mb-1 block text-[11px] font-medium text-(--text-muted)"
                  >
                    Sort by
                  </label>

                  <select
                    id="global-task-sort"
                    value={sortBy}
                    disabled={
                      isLoading
                    }
                    onChange={(
                      event,
                    ) =>
                      onSortByChange(
                        event.target
                          .value as
                          | "createdAt"
                          | "updatedAt"
                          | "deadline",
                      )
                    }
                    className={
                      inputClassName
                    }
                  >
                    <option value="createdAt">
                      Created
                    </option>

                    <option value="updatedAt">
                      Updated
                    </option>

                    <option value="deadline">
                      Deadline
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="global-task-sort-direction"
                    className="mb-1 block text-[11px] font-medium text-(--text-muted)"
                  >
                    Direction
                  </label>

                  <select
                    id="global-task-sort-direction"
                    value={
                      sortDirection
                    }
                    disabled={
                      isLoading
                    }
                    onChange={(
                      event,
                    ) =>
                      onSortDirectionChange(
                        event.target
                          .value as
                          | "asc"
                          | "desc",
                      )
                    }
                    className={
                      inputClassName
                    }
                  >
                    <option value="desc">
                      {sortBy ===
                      "deadline"
                        ? "Latest deadline first"
                        : "Newest first"}
                    </option>

                    <option value="asc">
                      {sortBy ===
                      "deadline"
                        ? "Earliest deadline first"
                        : "Oldest first"}
                    </option>
                  </select>
                </div>
              </div>
            </fieldset>
          </div>
        </details>
      </FilterDialogShell>
    </form>
  );
}
