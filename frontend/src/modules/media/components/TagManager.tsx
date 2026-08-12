import {
  Check,
  LoaderCircle,
  Pencil,
  Tag as TagIcon,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import { useTagStore } from "../../../stores/tagStore";
import type { Tag } from "../services/tagApi";

export function TagManager() {
  const tags = useTagStore(
    (state) => state.tags,
  );

  const isLoading = useTagStore(
    (state) => state.isLoading,
  );

  const isMutating = useTagStore(
    (state) => state.isMutating,
  );

  const error = useTagStore(
    (state) => state.error,
  );

  const loadTags = useTagStore(
    (state) => state.loadTags,
  );

  const renameTag = useTagStore(
    (state) => state.renameTag,
  );

  const getDeleteImpact = useTagStore(
    (state) => state.getDeleteImpact,
  );

  const deleteTag = useTagStore(
    (state) => state.deleteTag,
  );

  const clearError = useTagStore(
    (state) => state.clearError,
  );

  const [editingTagId, setEditingTagId] =
    useState<number | null>(null);

  const [editingName, setEditingName] =
    useState("");

  useEffect(() => {
    void loadTags().catch(() => {
      // tagStore keeps error.
    });
  }, [loadTags]);

  function startEditing(tag: Tag) {
    setEditingTagId(tag.id);
    setEditingName(tag.name);
    clearError();
  }

  function cancelEditing() {
    setEditingTagId(null);
    setEditingName("");
  }

  async function handleRename(
    tagId: number,
  ) {
    const name = editingName.trim();

    if (!name || isMutating) {
      return;
    }

    try {
      await renameTag(tagId, name);

      cancelEditing();
    } catch {
      // tagStore keeps error.
    }
  }

  async function handleDelete(tag: Tag) {
    if (isMutating) {
      return;
    }

    clearError();

    try {
      const impact =
        await getDeleteImpact(tag.id);

      const confirmed =
        window.confirm(
          [
            `Delete tag "${tag.name}"?`,
            "",
            `${impact.libraryVideoCountToDetach} video link(s) will be detached.`,
            impact.libraryVideosPreserved
              ? "Library videos will be preserved."
              : "Library videos may be affected.",
          ].join("\n"),
        );

      if (!confirmed) {
        return;
      }

      await deleteTag(tag.id);

      if (editingTagId === tag.id) {
        cancelEditing();
      }
    } catch {
      // tagStore keeps error.
    }
  }

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TagIcon
            size={15}
            className="text-neutral-500"
          />

          <div>
            <p className="text-sm font-medium text-neutral-200">
              Tag Manager
            </p>

            <p className="text-xs text-neutral-600">
              Rename or delete your tags.
            </p>
          </div>
        </div>

        <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-500">
          {tags.length}
        </span>
      </div>

      {isLoading && tags.length === 0 ? (
        <div className="flex items-center justify-center py-5">
          <LoaderCircle
            size={18}
            className="animate-spin text-neutral-500"
          />
        </div>
      ) : tags.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-neutral-800 p-3 text-xs text-neutral-600">
          No tags yet.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {tags.map((tag) => {
            const isEditing =
              editingTagId === tag.id;

            return (
              <div
                key={tag.id}
                className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-2"
              >
                {isEditing ? (
                  <>
                    <input
                      autoFocus
                      value={editingName}
                      maxLength={100}
                      disabled={isMutating}
                      onChange={(event) =>
                        setEditingName(
                          event.target.value,
                        )
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter"
                        ) {
                          event.preventDefault();

                          void handleRename(
                            tag.id,
                          );
                        }

                        if (
                          event.key === "Escape"
                        ) {
                          cancelEditing();
                        }
                      }}
                      className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs outline-none"
                    />

                    <button
                      type="button"
                      disabled={
                        isMutating ||
                        !editingName.trim()
                      }
                      onClick={() =>
                        void handleRename(
                          tag.id,
                        )
                      }
                      className="rounded-lg border border-neutral-700 p-1.5 text-neutral-400 hover:text-white disabled:opacity-40"
                      title="Save"
                    >
                      <Check size={13} />
                    </button>

                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={
                        cancelEditing
                      }
                      className="rounded-lg border border-neutral-700 p-1.5 text-neutral-500 hover:text-white disabled:opacity-40"
                      title="Cancel"
                    >
                      <X size={13} />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-xs text-neutral-300">
                      {tag.name}
                    </span>

                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() =>
                        startEditing(tag)
                      }
                      className="rounded-lg border border-neutral-800 p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:opacity-40"
                      title="Rename tag"
                    >
                      <Pencil size={13} />
                    </button>

                    <button
                      type="button"
                      disabled={isMutating}
                      onClick={() =>
                        void handleDelete(
                          tag,
                        )
                      }
                      className="rounded-lg border border-neutral-800 p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-300 disabled:opacity-40"
                      title="Delete tag"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">
          {error.message}
        </p>
      )}
    </div>
  );
}