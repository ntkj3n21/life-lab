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

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useTagStore } from "../../../stores/tagStore";
import type {
  Tag,
  TagDeleteImpact,
} from "../services/tagApi";

interface PendingTagDelete {
  tag: Tag;
  impact: TagDeleteImpact;
}

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

  const [
    editingTagId,
    setEditingTagId,
  ] = useState<number | null>(
    null,
  );

  const [
    editingName,
    setEditingName,
  ] = useState("");

  const [
    pendingDelete,
    setPendingDelete,
  ] =
    useState<PendingTagDelete | null>(
      null,
    );

  const [
    isPreparingDelete,
    setIsPreparingDelete,
  ] = useState(false);

  const controlsBusy =
    isMutating ||
    isPreparingDelete;

  useEffect(() => {
    void loadTags().catch(() => {
      // tagStore keeps error.
    });
  }, [loadTags]);

  function startEditing(
    tag: Tag,
  ) {
    setEditingTagId(
      tag.id,
    );
    setEditingName(
      tag.name,
    );
    clearError();
  }

  function cancelEditing() {
    setEditingTagId(
      null,
    );
    setEditingName(
      "",
    );
  }

  async function handleRename(
    tagId: number,
  ) {
    const name =
      editingName.trim();

    if (
      !name ||
      controlsBusy
    ) {
      return;
    }

    try {
      await renameTag(
        tagId,
        name,
      );

      cancelEditing();
    } catch {
      // tagStore keeps error.
    }
  }

  async function handleDelete(
    tag: Tag,
  ) {
    if (controlsBusy) {
      return;
    }

    clearError();
    setIsPreparingDelete(true);

    try {
      const impact =
        await getDeleteImpact(
          tag.id,
        );

      setPendingDelete({
        tag,
        impact,
      });
    } catch {
      // tagStore keeps error.
    } finally {
      setIsPreparingDelete(false);
    }
  }

  async function confirmDelete() {
    if (
      !pendingDelete ||
      isMutating
    ) {
      return;
    }

    clearError();

    try {
      await deleteTag(
        pendingDelete.tag.id,
      );

      if (
        editingTagId ===
        pendingDelete.tag.id
      ) {
        cancelEditing();
      }

      setPendingDelete(null);
    } catch {
      // tagStore keeps error.
    }
  }

  return (
    <>
      <div
        aria-busy={
          isLoading ||
          controlsBusy
        }
        className="rounded-xl border border-(--border) bg-(--app-bg) p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TagIcon
              size={15}
              className="text-(--text-muted)"
              aria-hidden="true"
            />

            <div>
              <p className="text-sm font-medium text-(--text-primary)">
                Tag Manager
              </p>

              <p className="text-xs text-(--text-faint)">
                Rename or delete your tags.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-(--surface) px-2 py-1 text-xs text-(--text-muted)">
            {tags.length}
          </span>
        </div>

        {isLoading &&
        tags.length === 0 ? (
          <div
            role="status"
            className="flex items-center justify-center py-5"
          >
            <LoaderCircle
              size={18}
              className="animate-spin text-(--text-muted)"
              aria-hidden="true"
            />
            <span className="sr-only">
              Loading tags
            </span>
          </div>
        ) : tags.length ===
          0 ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-dashed border-(--border) p-3 text-xs text-(--text-faint)"
          >
            No tags yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {tags.map((tag) => {
              const isEditing =
                editingTagId ===
                tag.id;

              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 rounded-lg border border-(--border) bg-(--surface) p-2"
                >
                  {isEditing ? (
                    <>
                      <label
                        htmlFor={`tag-name-${tag.id}`}
                        className="sr-only"
                      >
                        Tag name
                      </label>

                      <input
                        id={`tag-name-${tag.id}`}
                        autoFocus
                        value={editingName}
                        maxLength={100}
                        disabled={
                          controlsBusy
                        }
                        onChange={(event) =>
                          setEditingName(
                            event.target
                              .value,
                          )
                        }
                        onKeyDown={(
                          event,
                        ) => {
                          if (
                            event.key ===
                            "Enter"
                          ) {
                            event.preventDefault();

                            void handleRename(
                              tag.id,
                            );
                          }

                          if (
                            event.key ===
                            "Escape"
                          ) {
                            cancelEditing();
                          }
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-(--border-strong) bg-(--app-bg) px-2 py-1.5 text-xs outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
                      />

                      <button
                        type="button"
                        disabled={
                          controlsBusy ||
                          !editingName.trim()
                        }
                        onClick={() =>
                          void handleRename(
                            tag.id,
                          )
                        }
                        aria-label="Save tag name"
                        className="rounded-lg border border-(--border-strong) p-1.5 text-(--text-secondary) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                        title="Save"
                      >
                        <Check
                          size={13}
                          aria-hidden="true"
                        />
                      </button>

                      <button
                        type="button"
                        disabled={
                          controlsBusy
                        }
                        onClick={
                          cancelEditing
                        }
                        aria-label="Cancel tag rename"
                        className="rounded-lg border border-(--border-strong) p-1.5 text-(--text-muted) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                        title="Cancel"
                      >
                        <X
                          size={13}
                          aria-hidden="true"
                        />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 flex-1 truncate text-xs text-(--text-secondary)">
                        {tag.name}
                      </span>

                      <button
                        type="button"
                        disabled={
                          controlsBusy
                        }
                        onClick={() =>
                          startEditing(
                            tag,
                          )
                        }
                        aria-label={`Rename tag ${tag.name}`}
                        className="rounded-lg border border-(--border) p-1.5 text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                        title="Rename tag"
                      >
                        <Pencil
                          size={13}
                          aria-hidden="true"
                        />
                      </button>

                      <button
                        type="button"
                        disabled={
                          controlsBusy
                        }
                        onClick={() =>
                          void handleDelete(
                            tag,
                          )
                        }
                        aria-label={`Delete tag ${tag.name}`}
                        className="rounded-lg border border-(--border) p-1.5 text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                        title="Delete tag"
                      >
                        <Trash2
                          size={13}
                          aria-hidden="true"
                        />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error &&
          !pendingDelete && (
            <p
              role="alert"
              className="mt-2 text-xs text-(--danger-text)"
            >
              {error.message}
            </p>
          )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete
            ? `Delete tag "${pendingDelete.tag.name}"?`
            : "Delete tag?"
        }
        description="Deleting a tag only removes the tag and its links from Library videos."
        details={
          pendingDelete
            ? [
                `${pendingDelete.impact.libraryVideoCountToDetach} video link(s) will be detached.`,
                pendingDelete.impact.libraryVideosPreserved
                  ? "Library videos will be preserved."
                  : "Library videos may be affected.",
              ]
            : []
        }
        confirmLabel="Delete Tag"
        isBusy={isMutating}
        errorMessage={
          pendingDelete
            ? error?.message ?? null
            : null
        }
        onConfirm={confirmDelete}
        onCancel={() =>
          setPendingDelete(null)
        }
      />
    </>
  );
}