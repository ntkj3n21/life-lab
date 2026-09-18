import {
  Check,
  LoaderCircle,
  Pencil,
  Plus,
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

export type TagManagerChange =
  | {
      type: "created" | "renamed";
      tag: Tag;
    }
  | {
      type: "deleted";
      tag: Tag;
    };

interface TagManagerProps {
  onChange?: (
    change: TagManagerChange,
  ) => void;
}

export function TagManager({
  onChange,
}: TagManagerProps = {}) {
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

  const createTag = useTagStore(
    (state) => state.createTag,
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
    newTagName,
    setNewTagName,
  ] = useState("");

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
    isLoading ||
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

  async function handleCreate() {
    const name =
      newTagName.trim();

    if (
      !name ||
      controlsBusy
    ) {
      return;
    }

    clearError();

    try {
      const tag =
        await createTag(name);

      setNewTagName("");
      onChange?.({
        type: "created",
        tag,
      });
    } catch {
      // tagStore keeps error.
    }
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
      const tag = await renameTag(
        tagId,
        name,
      );

      cancelEditing();
      onChange?.({
        type: "renamed",
        tag,
      });
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

      const deletedTag =
        pendingDelete.tag;

      if (
        editingTagId ===
        pendingDelete.tag.id
      ) {
        cancelEditing();
      }

      setPendingDelete(null);
      onChange?.({
        type: "deleted",
        tag: deletedTag,
      });
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

              <p className="text-xs text-(--text-muted)">
                Create, rename, or delete tags.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-(--surface) px-2 py-1 text-xs text-(--text-muted)">
            {tags.length}
          </span>
        </div>

        <div className="mt-3 flex min-w-0 gap-2">
          <label
            htmlFor="manager-new-tag"
            className="sr-only"
          >
            New tag name
          </label>

          <input
            id="manager-new-tag"
            value={newTagName}
            maxLength={100}
            disabled={controlsBusy}
            onChange={(event) =>
              setNewTagName(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key === "Enter"
              ) {
                event.preventDefault();
                void handleCreate();
              }
            }}
            placeholder="Create tag..."
            className="h-10 min-w-0 flex-1 rounded-lg border border-(--border) bg-(--surface) px-2 text-xs outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 xl:h-8"
          />

          <button
            type="button"
            disabled={
              controlsBusy ||
              !newTagName.trim()
            }
            onClick={() =>
              void handleCreate()
            }
            aria-label="Create tag"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
            title="Create tag"
          >
            <Plus
              size={13}
              aria-hidden="true"
            />
          </button>
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
            className="mt-3 rounded-lg border border-dashed border-(--border) p-3 text-xs text-(--text-muted)"
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
                        className="h-10 min-w-0 flex-1 rounded-lg border border-(--border-strong) bg-(--app-bg) px-2 text-xs outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 xl:h-8"
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
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border-strong) text-(--text-secondary) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
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
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border-strong) text-(--text-muted) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
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
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
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
                        className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
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
        description="Deleting a tag removes that tag from organized items; the items themselves are preserved."
        details={
          pendingDelete
            ? [
                `${pendingDelete.impact.libraryVideoCountToDetach} video link(s) will be detached.`,
                `${pendingDelete.impact.noteCountToDetach} Note link(s) will be detached.`,
                `${pendingDelete.impact.taskCountToDetach} Task link(s) will be detached.`,
                pendingDelete.impact.libraryVideosPreserved
                  ? "Library videos will be preserved."
                  : "Library videos may be affected.",
                pendingDelete.impact.notesPreserved
                  ? "Notes will be preserved."
                  : "Notes may be affected.",
                pendingDelete.impact.tasksPreserved
                  ? "Tasks will be preserved."
                  : "Tasks may be affected.",
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
