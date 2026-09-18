import {
  Folder,
  LoaderCircle,
  Tags,
} from "lucide-react";
import { useState } from "react";

import type { Tag } from "../../media/services/tagApi";
import type { Category } from "../../organization/services/categoryApi";
import type { Note } from "../services/noteApi";

interface NoteOrganizationEditorProps {
  note: Note;
  categories: Category[];
  tags: Tag[];
  isBusy: boolean;
  errorMessage: string | null;
  onSave: (
    categoryId: number | null,
    tagIds: number[],
  ) => Promise<void>;
  onCancel: () => void;
}

export function NoteOrganizationEditor({
  note,
  categories,
  tags,
  isBusy,
  errorMessage,
  onSave,
  onCancel,
}: NoteOrganizationEditorProps) {
  const [categoryId, setCategoryId] =
    useState<number | null>(
      note.category?.id ?? null,
    );
  const [tagIds, setTagIds] =
    useState<number[]>(
      note.tags.map((tag) => tag.id),
    );

  function toggleTag(tagId: number) {
    setTagIds((current) =>
      current.includes(tagId)
        ? current.filter(
            (candidate) =>
              candidate !== tagId,
          )
        : [...current, tagId],
    );
  }

  return (
    <section
      aria-label={`Organize Note ${note.id}`}
      aria-busy={isBusy}
      className="mt-2 rounded-xl border border-(--border-strong) bg-(--app-bg) p-3"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-(--text-secondary)">
            <Folder
              size={13}
              aria-hidden="true"
            />
            Category
          </div>

          <label
            htmlFor={`note-category-${note.id}`}
            className="sr-only"
          >
            Note category
          </label>
          <select
            id={`note-category-${note.id}`}
            value={categoryId ?? ""}
            disabled={isBusy}
            onChange={(event) =>
              setCategoryId(
                event.target.value
                  ? Number(
                      event.target.value,
                    )
                  : null,
              )
            }
            className="min-h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-2 text-sm text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              No category
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

        <fieldset>
          <legend className="mb-2 flex items-center gap-2 text-xs font-medium text-(--text-secondary)">
            <Tags
              size={13}
              aria-hidden="true"
            />
            Tags
          </legend>

          {tags.length === 0 ? (
            <p className="rounded-lg border border-dashed border-(--border) p-2 text-xs text-(--text-muted)">
              No tags available.
            </p>
          ) : (
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-(--border) bg-(--surface) p-2">
              {tags.map((tag) => (
                <label
                  key={tag.id}
                  className="flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-2 text-xs text-(--text-secondary) hover:bg-(--surface-hover)"
                >
                  <input
                    type="checkbox"
                    checked={tagIds.includes(
                      tag.id,
                    )}
                    disabled={isBusy}
                    onChange={() =>
                      toggleTag(tag.id)
                    }
                    className="h-4 w-4 accent-(--primary-bg)"
                  />
                  <span className="min-w-0 truncate">
                    {tag.name}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      </div>

      {errorMessage && (
        <p
          role="alert"
          className="mt-3 text-xs text-(--danger-text)"
        >
          {errorMessage}
        </p>
      )}

      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={onCancel}
          className="min-h-9 rounded-lg border border-(--border) px-3 py-1.5 text-xs text-(--text-secondary) hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isBusy}
          onClick={() =>
            void onSave(
              categoryId,
              tagIds,
            )
          }
          className="flex min-h-9 items-center gap-2 rounded-lg bg-(--primary-bg) px-3 py-1.5 text-xs font-medium text-(--primary-text) hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
        >
          {isBusy && (
            <LoaderCircle
              size={13}
              className="animate-spin"
              aria-hidden="true"
            />
          )}
          {isBusy
            ? "Saving..."
            : "Save organization"}
        </button>
      </div>
    </section>
  );
}
