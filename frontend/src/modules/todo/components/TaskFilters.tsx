import {
  FilterX,
  LoaderCircle,
  Search,
} from "lucide-react";
import type { FormEvent } from "react";

import type { Tag } from "../../media/services/tagApi";
import type { Category } from "../../organization/services/categoryApi";
import type {
  TaskSourceStatus,
  TaskStatus,
} from "../services/taskApi";

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
  onSearchTextChange: (value: string) => void;
  onStatusChange: (
    status: "" | TaskStatus,
  ) => void;
  onDeadlineFromChange: (value: string) => void;
  onDeadlineToChange: (value: string) => void;
  onCategoryChange: (
    categoryId: number | undefined,
  ) => void;
  onTagIdsChange: (tagIds: number[]) => void;
  onSourceStatusChange: (
    sourceStatus: "" | TaskSourceStatus,
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
  "min-h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 text-sm text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50";

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
  onClear,
}: TaskFiltersProps) {
  return (
    <form
      aria-label="Task filters"
      onSubmit={onApply}
      className="mt-4 rounded-xl border border-(--border) bg-(--app-bg) p-4"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-w-0 items-center gap-2 rounded-xl border border-(--border) bg-(--surface) px-3 focus-within:border-(--border-strong) focus-within:ring-2 focus-within:ring-(--focus) md:col-span-2">
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
        </div>

        <div>
          <label
            htmlFor="global-task-status"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Status
          </label>
          <select
            id="global-task-status"
            value={status}
            disabled={isLoading}
            onChange={(event) =>
              onStatusChange(
                event.target.value as
                  | ""
                  | TaskStatus,
              )
            }
            className={inputClassName}
          >
            <option value="">All statuses</option>
            <option value="NOT_STARTED">Not started</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="global-task-source-status"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Source status
          </label>
          <select
            id="global-task-source-status"
            value={sourceStatus}
            disabled={isLoading}
            onChange={(event) =>
              onSourceStatusChange(
                event.target.value as
                  | ""
                  | TaskSourceStatus,
              )
            }
            className={inputClassName}
          >
            <option value="">All sources</option>
            <option value="INDEPENDENT">Independent</option>
            <option value="HAS_SOURCE">Has source</option>
            <option value="SOURCE_MISSING">Source missing</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="global-task-deadline-from"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Deadline from
          </label>
          <input
            id="global-task-deadline-from"
            type="date"
            value={deadlineFrom}
            disabled={isLoading}
            onChange={(event) =>
              onDeadlineFromChange(
                event.target.value,
              )
            }
            className={inputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="global-task-deadline-to"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Deadline to
          </label>
          <input
            id="global-task-deadline-to"
            type="date"
            value={deadlineTo}
            disabled={isLoading}
            onChange={(event) =>
              onDeadlineToChange(
                event.target.value,
              )
            }
            className={inputClassName}
          />
        </div>

        <div>
          <label
            htmlFor="global-task-category"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Category
          </label>
          <select
            id="global-task-category"
            value={categoryId ?? ""}
            disabled={
              isLoading ||
              categoriesLoading
            }
            onChange={(event) =>
              onCategoryChange(
                event.target.value
                  ? Number(
                      event.target.value,
                    )
                  : undefined,
              )
            }
            className={inputClassName}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option
                key={category.id}
                value={category.id}
              >
                {category.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="global-task-sort"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Sort
          </label>
          <select
            id="global-task-sort"
            value={sortBy}
            disabled={isLoading}
            onChange={(event) =>
              onSortByChange(
                event.target.value as
                  | "createdAt"
                  | "updatedAt"
                  | "deadline",
              )
            }
            className={inputClassName}
          >
            <option value="createdAt">Created</option>
            <option value="updatedAt">Updated</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="global-task-sort-direction"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Direction
          </label>
          <select
            id="global-task-sort-direction"
            value={sortDirection}
            disabled={isLoading}
            onChange={(event) =>
              onSortDirectionChange(
                event.target.value as
                  | "asc"
                  | "desc",
              )
            }
            className={inputClassName}
          >
            <option value="desc">
              {sortBy === "deadline"
                ? "Latest deadline first"
                : "Newest first"}
            </option>
            <option value="asc">
              {sortBy === "deadline"
                ? "Earliest deadline first"
                : "Oldest first"}
            </option>
          </select>
        </div>
      </div>

      <fieldset className="mt-4">
        <legend className="text-xs font-medium text-(--text-secondary)">
          Tags
        </legend>
        {tagsLoading && tags.length === 0 ? (
          <p className="mt-2 text-xs text-(--text-muted)">
            Loading tags...
          </p>
        ) : tags.length === 0 ? (
          <p className="mt-2 text-xs text-(--text-muted)">
            No tags available.
          </p>
        ) : (
          <div className="mt-2 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
            {tags.map((tag) => {
              const checked = tagIds.includes(
                tag.id,
              );

              return (
                <label
                  key={tag.id}
                  className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs transition ${
                    checked
                      ? "border-(--border-strong) bg-(--surface-hover) text-(--text-primary)"
                      : "border-(--border) bg-(--surface) text-(--text-secondary) hover:border-(--border-strong)"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={isLoading}
                    onChange={() =>
                      onTagIdsChange(
                        checked
                          ? tagIds.filter(
                              (tagId) =>
                                tagId !== tag.id,
                            )
                          : [
                              ...tagIds,
                              tag.id,
                            ],
                      )
                    }
                    className="h-4 w-4 accent-(--primary-bg)"
                  />
                  {tag.name}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-(--border) pt-3">
        <p className="text-xs text-(--text-muted)">
          Multiple tags match Tasks with any selected tag.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isLoading || !canClear}
            onClick={onClear}
            className="flex min-h-10 items-center gap-2 rounded-lg border border-(--border) px-3 py-2 text-xs text-(--text-secondary) hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-40"
          >
            <FilterX size={13} aria-hidden="true" />
            Clear filters
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex min-h-10 items-center gap-2 rounded-lg bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
          >
            {isLoading && (
              <LoaderCircle
                size={14}
                className="animate-spin"
                aria-hidden="true"
              />
            )}
            Apply filters
          </button>
        </div>
      </div>
    </form>
  );
}
