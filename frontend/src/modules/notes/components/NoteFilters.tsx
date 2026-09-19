import {
  LoaderCircle,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  type FormEvent,
  useId,
  useState,
} from "react";

import { FilterDialogShell } from "../../../components/ui/FilterDialogShell";
import type { Tag } from "../../media/services/tagApi";
import type { Category } from "../../organization/services/categoryApi";

export interface NoteFilterValues {
  categoryId?: number;
  tagIds: number[];
  hasTimestamp?: boolean;
  sortBy: "createdAt" | "updatedAt";
  sortDirection: "asc" | "desc";
}

interface NoteFiltersProps {
  searchText: string;
  filters: NoteFilterValues;
  categories: Category[];
  tags: Tag[];
  categoriesLoading: boolean;
  tagsLoading: boolean;
  isLoading: boolean;

  onSearchTextChange: (
    value: string,
  ) => void;

  onSearch: (
    event: FormEvent<HTMLFormElement>,
  ) => void;

  onApplyFilters: (
    filters: NoteFilterValues,
  ) => void;
}

const selectClassName =
  "min-h-10 w-full rounded-lg border border-(--border) bg-(--app-bg) px-3 text-sm text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50";

const DEFAULT_FILTERS: NoteFilterValues = {
  tagIds: [],
  sortBy: "createdAt",
  sortDirection: "desc",
};

function cloneFilters(
  filters: NoteFilterValues,
): NoteFilterValues {
  return {
    ...filters,
    tagIds: [...filters.tagIds],
  };
}

export function NoteFilters({
  searchText,
  filters,
  categories,
  tags,
  categoriesLoading,
  tagsLoading,
  isLoading,
  onSearchTextChange,
  onSearch,
  onApplyFilters,
}: NoteFiltersProps) {
  const dialogId = useId();

  const [
    showFilters,
    setShowFilters,
  ] = useState(false);

  const [
    draftFilters,
    setDraftFilters,
  ] = useState<NoteFilterValues>(() =>
    cloneFilters(filters),
  );

  function handleOpenFilters() {
    setDraftFilters(
      cloneFilters(filters),
    );
    setShowFilters(true);
  }

  function handleDismissFilters() {
    if (isLoading) {
      return;
    }

    setShowFilters(false);
  }

  function handleResetDraft() {
    setDraftFilters(
      cloneFilters(DEFAULT_FILTERS),
    );
  }

  function handleApplyFilters() {
    onApplyFilters(
      cloneFilters(draftFilters),
    );

    setShowFilters(false);
  }

  function handleToggleTag(
    tagId: number,
  ) {
    setDraftFilters((current) => ({
      ...current,
      tagIds: current.tagIds.includes(
        tagId,
      )
        ? current.tagIds.filter(
            (currentTagId) =>
              currentTagId !== tagId,
          )
        : [
            ...current.tagIds,
            tagId,
          ],
    }));
  }

  const dialogFooter = (
    <>
      <button
        type="button"
        onClick={handleResetDraft}
        disabled={isLoading}
        className="min-h-10 rounded-lg px-3 py-2 text-sm text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
      >
        Reset
      </button>

      <div className="flex min-w-0 flex-1 justify-end gap-2">
        <button
          type="button"
          onClick={handleDismissFilters}
          disabled={isLoading}
          className="min-h-10 rounded-lg border border-(--border) px-3 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleApplyFilters}
          disabled={isLoading}
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
    <section
      aria-label="Note filters"
      aria-busy={isLoading}
      className="mt-5"
    >
      <form
        onSubmit={onSearch}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-(--border) bg-(--app-bg) px-3 transition focus-within:border-(--border-strong) focus-within:ring-2 focus-within:ring-(--focus)">
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
          aria-expanded={showFilters}
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
      </form>

      <FilterDialogShell
        open={showFilters}
        dialogId={dialogId}
        title="Note filters"
        description="Refine the current Notes results. Changes apply only when you confirm them."
        isBusy={isLoading}
        onDismiss={handleDismissFilters}
        closeAriaLabel="Close Note filters"
        maxWidthClassName="max-w-3xl"
        footer={dialogFooter}
      >
        <p className="text-xs font-medium text-(--text-secondary)">
          Primary filters
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
            <legend className="px-1 text-xs font-medium text-(--text-secondary)">
              Organization
            </legend>

            <label
              htmlFor="note-category-filter"
              className="mb-1.5 block text-[11px] font-medium text-(--text-muted)"
            >
              Category
            </label>

            <select
              id="note-category-filter"
              value={
                draftFilters.categoryId ??
                ""
              }
              disabled={
                isLoading ||
                categoriesLoading
              }
              onChange={(event) =>
                setDraftFilters(
                  (current) => ({
                    ...current,
                    categoryId:
                      event.target.value
                        ? Number(
                            event.target
                              .value,
                          )
                        : undefined,
                  }),
                )
              }
              className={
                selectClassName
              }
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
          </fieldset>

          <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
            <legend className="px-1 text-xs font-medium text-(--text-secondary)">
              Source context
            </legend>

            <label
              htmlFor="note-timestamp-filter"
              className="mb-1.5 block text-[11px] font-medium text-(--text-muted)"
            >
              Timestamp
            </label>

            <select
              id="note-timestamp-filter"
              value={
                draftFilters.hasTimestamp ===
                undefined
                  ? ""
                  : String(
                      draftFilters.hasTimestamp,
                    )
              }
              disabled={isLoading}
              onChange={(event) =>
                setDraftFilters(
                  (current) => ({
                    ...current,
                    hasTimestamp:
                      event.target.value ===
                      ""
                        ? undefined
                        : event.target
                              .value ===
                            "true",
                  }),
                )
              }
              className={
                selectClassName
              }
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
                    draftFilters.tagIds.includes(
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
                Multiple selected tags match Notes with any selected tag.
              </p>
            </>
          )}
        </fieldset>

        <fieldset className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
          <legend className="px-1 text-xs font-medium text-(--text-secondary)">
            Sort
          </legend>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label
                htmlFor="note-sort-filter"
                className="mb-1 block text-[11px] font-medium text-(--text-muted)"
              >
                Sort by
              </label>

              <select
                id="note-sort-filter"
                value={
                  draftFilters.sortBy
                }
                disabled={isLoading}
                onChange={(event) =>
                  setDraftFilters(
                    (current) => ({
                      ...current,
                      sortBy:
                        event.target
                          .value as NoteFilterValues["sortBy"],
                    }),
                  )
                }
                className={
                  selectClassName
                }
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
                className="mb-1 block text-[11px] font-medium text-(--text-muted)"
              >
                Direction
              </label>

              <select
                id="note-direction-filter"
                value={
                  draftFilters.sortDirection
                }
                disabled={isLoading}
                onChange={(event) =>
                  setDraftFilters(
                    (current) => ({
                      ...current,
                      sortDirection:
                        event.target
                          .value as NoteFilterValues["sortDirection"],
                    }),
                  )
                }
                className={
                  selectClassName
                }
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
        </fieldset>
      </FilterDialogShell>
    </section>
  );
}
