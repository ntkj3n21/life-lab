import {
  FilterX,
  Search,
} from "lucide-react";
import type { FormEvent } from "react";

import type { Tag } from "../../media/services/tagApi";
import type { Category } from "../../organization/services/categoryApi";

interface NoteFiltersProps {
  searchText: string;
  categoryId?: number;
  tagIds: number[];
  hasTimestamp?: boolean;
  sortBy: "createdAt" | "updatedAt";
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
  onSearch: (
    event: FormEvent<HTMLFormElement>,
  ) => void;
  onCategoryChange: (
    categoryId: number | undefined,
  ) => void;
  onTagIdsChange: (
    tagIds: number[],
  ) => void;
  onTimestampChange: (
    hasTimestamp: boolean | undefined,
  ) => void;
  onSortByChange: (
    sortBy: "createdAt" | "updatedAt",
  ) => void;
  onSortDirectionChange: (
    sortDirection: "asc" | "desc",
  ) => void;
  onClear: () => void;
}

const selectClassName =
  "min-h-10 w-full rounded-lg border border-(--border) bg-(--app-bg) px-2 text-sm text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50";

export function NoteFilters({
  searchText,
  categoryId,
  tagIds,
  hasTimestamp,
  sortBy,
  sortDirection,
  categories,
  tags,
  categoriesLoading,
  tagsLoading,
  isLoading,
  canClear,
  onSearchTextChange,
  onSearch,
  onCategoryChange,
  onTagIdsChange,
  onTimestampChange,
  onSortByChange,
  onSortDirectionChange,
  onClear,
}: NoteFiltersProps) {
  return (
    <section
      aria-label="Note filters"
      className="mt-5 rounded-2xl border border-(--border) bg-(--surface) p-4"
    >
      <form
        onSubmit={onSearch}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-(--border) bg-(--app-bg) px-3 focus-within:border-(--border-strong) focus-within:ring-2 focus-within:ring-(--focus)">
          <Search
            size={16}
            className="shrink-0 text-(--text-muted)"
            aria-hidden="true"
          />
          <label
            htmlFor="global-note-search"
            className="sr-only"
          >
            Search Notes
          </label>
          <input
            id="global-note-search"
            value={searchText}
            disabled={isLoading}
            onChange={(event) =>
              onSearchTextChange(
                event.target.value,
              )
            }
            placeholder="Search notes and source details..."
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-(--text-faint) disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-(--primary-bg) px-4 py-2 text-sm font-medium text-(--primary-text) transition hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          Search
        </button>
      </form>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="note-category-filter"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Category
          </label>
          <select
            id="note-category-filter"
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
            className={selectClassName}
          >
            <option value="">
              All categories
            </option>
            {categories.map(
              (category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ),
            )}
          </select>
        </div>

        <div>
          <label
            htmlFor="note-timestamp-filter"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Timestamp
          </label>
          <select
            id="note-timestamp-filter"
            value={
              hasTimestamp === undefined
                ? ""
                : String(hasTimestamp)
            }
            disabled={isLoading}
            onChange={(event) =>
              onTimestampChange(
                event.target.value === ""
                  ? undefined
                  : event.target.value ===
                    "true",
              )
            }
            className={selectClassName}
          >
            <option value="">
              All timestamps
            </option>
            <option value="true">
              With timestamp
            </option>
            <option value="false">
              Without timestamp
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor="note-sort-filter"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Sort
          </label>
          <select
            id="note-sort-filter"
            value={sortBy}
            disabled={isLoading}
            onChange={(event) =>
              onSortByChange(
                event.target.value as
                  | "createdAt"
                  | "updatedAt",
              )
            }
            className={selectClassName}
          >
            <option value="createdAt">
              Created
            </option>
            <option value="updatedAt">
              Updated
            </option>
          </select>
        </div>

        <div>
          <label
            htmlFor="note-direction-filter"
            className="mb-1.5 block text-xs font-medium text-(--text-secondary)"
          >
            Direction
          </label>
          <select
            id="note-direction-filter"
            value={sortDirection}
            disabled={isLoading}
            onChange={(event) =>
              onSortDirectionChange(
                event.target.value as
                  | "asc"
                  | "desc",
              )
            }
            className={selectClassName}
          >
            <option value="desc">
              Newest first
            </option>
            <option value="asc">
              Oldest first
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
              const checked =
                tagIds.includes(tag.id);

              return (
                <label
                  key={tag.id}
                  className={`flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs transition ${
                    checked
                      ? "border-(--border-strong) bg-(--surface-hover) text-(--text-primary)"
                      : "border-(--border) bg-(--app-bg) text-(--text-secondary) hover:border-(--border-strong)"
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
                                tagId !==
                                tag.id,
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
          Multiple tags match Notes with any selected tag.
        </p>
        <button
          type="button"
          disabled={isLoading || !canClear}
          onClick={onClear}
          className="flex min-h-9 items-center gap-2 rounded-lg border border-(--border) px-3 py-1.5 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
        >
          <FilterX
            size={13}
            aria-hidden="true"
          />
          Clear filters
        </button>
      </div>
    </section>
  );
}
