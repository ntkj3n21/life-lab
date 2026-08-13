import {
  LoaderCircle,
  RotateCcw,
  Search,
  SlidersHorizontal,
} from "lucide-react";

import type { LibraryQuery } from "../services/libraryApi";
import type { Tag } from "../services/tagApi";

export type BooleanFilter =
  | ""
  | "true"
  | "false";

export type LibrarySortBy =
  NonNullable<
    LibraryQuery["sortBy"]
  >;

export type LibrarySortDirection =
  NonNullable<
    LibraryQuery["sortDirection"]
  >;

interface LibraryFiltersProps {
  tags: Tag[];

  searchText: string;

  selectedTagIds: number[];

  minDurationSeconds: string;
  maxDurationSeconds: string;

  publishedFrom: string;
  publishedTo: string;

  addedFrom: string;
  addedTo: string;

  watchedFilter: BooleanFilter;
  notesFilter: BooleanFilter;

  sortBy: LibrarySortBy;
  sortDirection:
    LibrarySortDirection;

  showAdvancedFilters: boolean;
  isLoading: boolean;
  watchAndSortLocked: boolean;

  validationMessage?:
    | string
    | null;

  onSearchTextChange: (
    value: string,
  ) => void;

  onToggleTag: (
    tagId: number,
  ) => void;

  onMinDurationSecondsChange: (
    value: string,
  ) => void;

  onMaxDurationSecondsChange: (
    value: string,
  ) => void;

  onPublishedFromChange: (
    value: string,
  ) => void;

  onPublishedToChange: (
    value: string,
  ) => void;

  onAddedFromChange: (
    value: string,
  ) => void;

  onAddedToChange: (
    value: string,
  ) => void;

  onWatchedFilterChange: (
    value: BooleanFilter,
  ) => void;

  onNotesFilterChange: (
    value: BooleanFilter,
  ) => void;

  onSortByChange: (
    value: LibrarySortBy,
  ) => void;

  onSortDirectionChange: (
    value:
      LibrarySortDirection,
  ) => void;

  onToggleAdvancedFilters:
    () => void;

  onApply: () => Promise<void>;
  onReset: () => Promise<void>;
}

const inputClassName =
  "w-full rounded-xl border border-(--border) bg-(--surface) px-3 py-2 text-xs text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50";

export function LibraryFilters({
  tags,
  searchText,
  selectedTagIds,
  minDurationSeconds,
  maxDurationSeconds,
  publishedFrom,
  publishedTo,
  addedFrom,
  addedTo,
  watchedFilter,
  notesFilter,
  sortBy,
  sortDirection,
  showAdvancedFilters,
  isLoading,
  watchAndSortLocked,
  validationMessage,
  onSearchTextChange,
  onToggleTag,
  onMinDurationSecondsChange,
  onMaxDurationSecondsChange,
  onPublishedFromChange,
  onPublishedToChange,
  onAddedFromChange,
  onAddedToChange,
  onWatchedFilterChange,
  onNotesFilterChange,
  onSortByChange,
  onSortDirectionChange,
  onToggleAdvancedFilters,
  onApply,
  onReset,
}: LibraryFiltersProps) {
  return (
    <div
      aria-busy={isLoading}
      className="mt-4"
    >
      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-(--border) bg-(--app-bg) px-3 shadow-sm transition focus-within:border-(--border-strong) focus-within:ring-2 focus-within:ring-(--focus)">
          <Search
            size={15}
            className="shrink-0 text-(--text-muted)"
            aria-hidden="true"
          />

          <label
            htmlFor="library-search"
            className="sr-only"
          >
            Search videos
          </label>

          <input
            id="library-search"
            value={searchText}
            disabled={isLoading}
            onChange={(event) =>
              onSearchTextChange(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter"
              ) {
                void onApply();
              }
            }}
            placeholder="Search library..."
            className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-(--text-faint) disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <button
          type="button"
          onClick={() =>
            void onApply()
          }
          disabled={isLoading}
          aria-label="Search library"
          title="Search library"
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-(--primary-bg) text-(--primary-text) hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && (
            <LoaderCircle
              size={14}
              className="animate-spin"
              aria-hidden="true"
            />
          )}

          {!isLoading && (
            <Search
              size={16}
              aria-hidden="true"
            />
          )}
        </button>

        <button
          type="button"
          onClick={
            onToggleAdvancedFilters
          }
          aria-expanded={
            showAdvancedFilters
          }
          className="flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm text-(--text-secondary) hover:bg-(--surface-subtle) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
        >
          <SlidersHorizontal
            size={15}
            aria-hidden="true"
          />
          Filters
        </button>

        <button
          type="button"
          onClick={() =>
            void onReset()
          }
          disabled={isLoading}
          aria-label="Reset library filters"
          title="Reset filters"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-(--text-muted) hover:bg-(--surface-subtle) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw
            size={15}
            aria-hidden="true"
          />
        </button>
      </div>

      {validationMessage && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-(--warning-border) bg-(--warning-surface) px-3 py-2 text-xs text-(--warning-text)"
        >
          {validationMessage}
        </p>
      )}

      {showAdvancedFilters && (
        <div className="mt-4 space-y-3">
          {watchAndSortLocked && (
            <p
              role="status"
              className="rounded-xl border border-(--border) bg-(--surface) px-3 py-2 text-xs leading-5 text-(--text-muted)"
            >
              The current Library view controls watch status and sort order. Keyword, date, duration, tag, and Note filters still combine with this view.
            </p>
          )}

          <div className="grid gap-3 xl:grid-cols-2">
            <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
              <legend className="px-1 text-xs font-medium text-(--text-secondary)">
                Personal tags
              </legend>

              {tags.length === 0 ? (
                <p className="text-xs text-(--text-faint)">
                  No tags available.
                </p>
              ) : (
                <>
                  <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                    {tags.map(
                      (tag) => {
                        const checked =
                          selectedTagIds.includes(
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
                                onToggleTag(
                                  tag.id,
                                )
                              }
                              className="accent-(--primary-bg)"
                            />

                            <span className="wrap-break-word">
                              {tag.name}
                            </span>
                          </label>
                        );
                      },
                    )}
                  </div>

                  <p className="mt-2 text-[10px] leading-4 text-(--text-faint)">
                    Multiple selected tags are matched with OR. Tag filtering is combined with other filter groups using AND.
                  </p>
                </>
              )}
            </fieldset>

            <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
              <legend className="px-1 text-xs font-medium text-(--text-secondary)">
                Activity and Notes
              </legend>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="library-watched-filter"
                    className="mb-1 block text-[11px] font-medium text-(--text-faint)"
                  >
                    Watch status
                  </label>

                  <select
                    id="library-watched-filter"
                    value={
                      watchedFilter
                    }
                    disabled={
                      isLoading ||
                      watchAndSortLocked
                    }
                    onChange={(
                      event,
                    ) =>
                      onWatchedFilterChange(
                        event.target
                          .value as BooleanFilter,
                      )
                    }
                    className={
                      inputClassName
                    }
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
                </div>

                <div>
                  <label
                    htmlFor="library-notes-filter"
                    className="mb-1 block text-[11px] font-medium text-(--text-faint)"
                  >
                    Note status
                  </label>

                  <select
                    id="library-notes-filter"
                    value={notesFilter}
                    disabled={isLoading}
                    onChange={(
                      event,
                    ) =>
                      onNotesFilterChange(
                        event.target
                          .value as BooleanFilter,
                      )
                    }
                    className={
                      inputClassName
                    }
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
                </div>
              </div>
            </fieldset>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
              <legend className="px-1 text-xs font-medium text-(--text-secondary)">
                Duration
              </legend>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <label
                    htmlFor="library-duration-min"
                    className="mb-1 block text-[11px] font-medium text-(--text-faint)"
                  >
                    Min seconds
                  </label>

                  <input
                    id="library-duration-min"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={
                      minDurationSeconds
                    }
                    disabled={isLoading}
                    onChange={(
                      event,
                    ) =>
                      onMinDurationSecondsChange(
                        event.target
                          .value,
                      )
                    }
                    placeholder="0"
                    className={
                      inputClassName
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="library-duration-max"
                    className="mb-1 block text-[11px] font-medium text-(--text-faint)"
                  >
                    Max seconds
                  </label>

                  <input
                    id="library-duration-max"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    value={
                      maxDurationSeconds
                    }
                    disabled={isLoading}
                    onChange={(
                      event,
                    ) =>
                      onMaxDurationSecondsChange(
                        event.target
                          .value,
                      )
                    }
                    placeholder="Any"
                    className={
                      inputClassName
                    }
                  />
                </div>
              </div>
            </fieldset>

            <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
              <legend className="px-1 text-xs font-medium text-(--text-secondary)">
                YouTube published date
              </legend>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <label
                    htmlFor="library-published-from"
                    className="mb-1 block text-[11px] font-medium text-(--text-faint)"
                  >
                    From
                  </label>

                  <input
                    id="library-published-from"
                    type="date"
                    value={
                      publishedFrom
                    }
                    disabled={isLoading}
                    onChange={(
                      event,
                    ) =>
                      onPublishedFromChange(
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
                    htmlFor="library-published-to"
                    className="mb-1 block text-[11px] font-medium text-(--text-faint)"
                  >
                    To
                  </label>

                  <input
                    id="library-published-to"
                    type="date"
                    value={publishedTo}
                    disabled={isLoading}
                    onChange={(
                      event,
                    ) =>
                      onPublishedToChange(
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
                Added to Life Lab
              </legend>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <label
                    htmlFor="library-added-from"
                    className="mb-1 block text-[11px] font-medium text-(--text-faint)"
                  >
                    From
                  </label>

                  <input
                    id="library-added-from"
                    type="date"
                    value={addedFrom}
                    disabled={isLoading}
                    onChange={(
                      event,
                    ) =>
                      onAddedFromChange(
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
                    htmlFor="library-added-to"
                    className="mb-1 block text-[11px] font-medium text-(--text-faint)"
                  >
                    To
                  </label>

                  <input
                    id="library-added-to"
                    type="date"
                    value={addedTo}
                    disabled={isLoading}
                    onChange={(
                      event,
                    ) =>
                      onAddedToChange(
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
          </div>

          <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
            <legend className="px-1 text-xs font-medium text-(--text-secondary)">
              Sort Library
            </legend>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="library-sort-by"
                  className="mb-1 block text-[11px] font-medium text-(--text-faint)"
                >
                  Sort by
                </label>

                <select
                  id="library-sort-by"
                  value={sortBy}
                  disabled={
                    isLoading ||
                    watchAndSortLocked
                  }
                  onChange={(
                    event,
                  ) =>
                    onSortByChange(
                      event.target
                        .value as LibrarySortBy,
                    )
                  }
                  className={
                    inputClassName
                  }
                >
                  <option value="addedAt">
                    Added date
                  </option>
                  <option value="duration">
                    Duration
                  </option>
                  <option value="viewCount">
                    Personal view count
                  </option>
                  <option value="lastWatchedAt">
                    Last watched
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="library-sort-direction"
                  className="mb-1 block text-[11px] font-medium text-(--text-faint)"
                >
                  Direction
                </label>

                <select
                  id="library-sort-direction"
                  value={
                    sortDirection
                  }
                  disabled={
                    isLoading ||
                    watchAndSortLocked
                  }
                  onChange={(
                    event,
                  ) =>
                    onSortDirectionChange(
                      event.target
                        .value as LibrarySortDirection,
                    )
                  }
                  className={
                    inputClassName
                  }
                >
                  <option value="desc">
                    Descending
                  </option>
                  <option value="asc">
                    Ascending
                  </option>
                </select>
              </div>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
