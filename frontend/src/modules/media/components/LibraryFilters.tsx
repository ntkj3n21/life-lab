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
  "w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50";

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
      className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-3"
    >
      <div className="flex flex-col gap-2 lg:flex-row">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3 focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-700">
          <Search
            size={15}
            className="shrink-0 text-neutral-500"
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
            placeholder="Search title, channel, personal info or tags..."
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <button
          type="button"
          onClick={() =>
            void onApply()
          }
          disabled={isLoading}
          className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading && (
            <LoaderCircle
              size={14}
              className="animate-spin"
              aria-hidden="true"
            />
          )}

          {isLoading
            ? "Applying..."
            : "Apply"}
        </button>

        <button
          type="button"
          onClick={
            onToggleAdvancedFilters
          }
          aria-expanded={
            showAdvancedFilters
          }
          className="flex items-center justify-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700"
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
          className="flex items-center justify-center rounded-xl border border-neutral-800 px-3 py-2 text-neutral-500 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
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
          className="mt-3 rounded-xl border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-300"
        >
          {validationMessage}
        </p>
      )}

      {showAdvancedFilters && (
        <div className="mt-4 space-y-3">
          {watchAndSortLocked && (
            <p
              role="status"
              className="rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs leading-5 text-neutral-500"
            >
              The current Library view controls watch status and sort order. Keyword, date, duration, tag, and Note filters still combine with this view.
            </p>
          )}

          <div className="grid gap-3 xl:grid-cols-2">
            <fieldset className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
              <legend className="px-1 text-xs font-medium text-neutral-400">
                Personal tags
              </legend>

              {tags.length === 0 ? (
                <p className="text-xs text-neutral-600">
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
                                ? "border-neutral-600 bg-neutral-800 text-neutral-200"
                                : "border-neutral-800 bg-neutral-950 text-neutral-500 hover:text-neutral-300"
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
                              className="accent-neutral-200"
                            />

                            <span className="wrap-break-word">
                              {tag.name}
                            </span>
                          </label>
                        );
                      },
                    )}
                  </div>

                  <p className="mt-2 text-[10px] leading-4 text-neutral-600">
                    Multiple selected tags are matched with OR. Tag filtering is combined with other filter groups using AND.
                  </p>
                </>
              )}
            </fieldset>

            <fieldset className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
              <legend className="px-1 text-xs font-medium text-neutral-400">
                Activity and Notes
              </legend>

              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="library-watched-filter"
                    className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-600"
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
                    className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-600"
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
            <fieldset className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
              <legend className="px-1 text-xs font-medium text-neutral-400">
                Duration
              </legend>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <label
                    htmlFor="library-duration-min"
                    className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-600"
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
                    className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-600"
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

            <fieldset className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
              <legend className="px-1 text-xs font-medium text-neutral-400">
                YouTube published date
              </legend>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <label
                    htmlFor="library-published-from"
                    className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-600"
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
                    className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-600"
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

            <fieldset className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
              <legend className="px-1 text-xs font-medium text-neutral-400">
                Added to Life Lab
              </legend>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <label
                    htmlFor="library-added-from"
                    className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-600"
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
                    className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-600"
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

          <fieldset className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-3">
            <legend className="px-1 text-xs font-medium text-neutral-400">
              Sort Library
            </legend>

            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="library-sort-by"
                  className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-600"
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
                  className="mb-1 block text-[10px] uppercase tracking-wide text-neutral-600"
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