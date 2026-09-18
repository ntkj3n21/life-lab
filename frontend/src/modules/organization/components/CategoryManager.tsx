import {
  Check,
  Folder,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useCategoryStore } from "../../../stores/categoryStore";
import type {
  Category,
  CategoryDeleteImpact,
} from "../services/categoryApi";

interface PendingCategoryDelete {
  category: Category;
  impact: CategoryDeleteImpact;
}

export type CategoryManagerChange =
  | {
      type: "created" | "renamed";
      category: Category;
    }
  | {
      type: "deleted";
      category: Category;
    };

interface CategoryManagerProps {
  onChange?: (
    change: CategoryManagerChange,
  ) => void;
}

export function CategoryManager({
  onChange,
}: CategoryManagerProps = {}) {
  const categories =
    useCategoryStore(
      (state) => state.categories,
    );
  const isLoading =
    useCategoryStore(
      (state) => state.isLoading,
    );
  const isMutating =
    useCategoryStore(
      (state) => state.isMutating,
    );
  const error = useCategoryStore(
    (state) => state.error,
  );
  const loadCategories =
    useCategoryStore(
      (state) =>
        state.loadCategories,
    );
  const createCategory =
    useCategoryStore(
      (state) =>
        state.createCategory,
    );
  const renameCategory =
    useCategoryStore(
      (state) =>
        state.renameCategory,
    );
  const getDeleteImpact =
    useCategoryStore(
      (state) =>
        state.getDeleteImpact,
    );
  const deleteCategory =
    useCategoryStore(
      (state) =>
        state.deleteCategory,
    );
  const clearError =
    useCategoryStore(
      (state) => state.clearError,
    );

  const [newName, setNewName] =
    useState("");
  const [editingId, setEditingId] =
    useState<number | null>(null);
  const [editingName, setEditingName] =
    useState("");
  const [pendingDelete, setPendingDelete] =
    useState<PendingCategoryDelete | null>(
      null,
    );
  const [isPreparingDelete, setIsPreparingDelete] =
    useState(false);

  const controlsBusy =
    isLoading ||
    isMutating ||
    isPreparingDelete;

  useEffect(() => {
    void loadCategories().catch(
      () => {
        // categoryStore keeps error.
      },
    );
  }, [loadCategories]);

  async function handleCreate() {
    const name = newName.trim();

    if (!name || controlsBusy) {
      return;
    }

    clearError();

    try {
      const category =
        await createCategory(name);

      setNewName("");
      onChange?.({
        type: "created",
        category,
      });
    } catch {
      // categoryStore keeps error.
    }
  }

  function startEditing(
    category: Category,
  ) {
    setEditingId(category.id);
    setEditingName(category.name);
    clearError();
  }

  function cancelEditing() {
    setEditingId(null);
    setEditingName("");
  }

  async function handleRename(
    categoryId: number,
  ) {
    const name = editingName.trim();

    if (!name || controlsBusy) {
      return;
    }

    try {
      const category =
        await renameCategory(
          categoryId,
          name,
        );

      cancelEditing();
      onChange?.({
        type: "renamed",
        category,
      });
    } catch {
      // categoryStore keeps error.
    }
  }

  async function handleDelete(
    category: Category,
  ) {
    if (controlsBusy) {
      return;
    }

    clearError();
    setIsPreparingDelete(true);

    try {
      const impact =
        await getDeleteImpact(
          category.id,
        );

      setPendingDelete({
        category,
        impact,
      });
    } catch {
      // categoryStore keeps error.
    } finally {
      setIsPreparingDelete(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || isMutating) {
      return;
    }

    clearError();

    try {
      await deleteCategory(
        pendingDelete.category.id,
      );

      const deletedCategory =
        pendingDelete.category;

      if (
        editingId ===
        deletedCategory.id
      ) {
        cancelEditing();
      }

      setPendingDelete(null);
      onChange?.({
        type: "deleted",
        category:
          deletedCategory,
      });
    } catch {
      // categoryStore keeps error.
    }
  }

  return (
    <>
      <div
        aria-busy={
          isLoading || controlsBusy
        }
        className="rounded-xl border border-(--border) bg-(--app-bg) p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Folder
              size={15}
              className="text-(--text-muted)"
              aria-hidden="true"
            />

            <div>
              <p className="text-sm font-medium text-(--text-primary)">
                Category Manager
              </p>
              <p className="text-xs text-(--text-muted)">
                Create, rename, or delete categories.
              </p>
            </div>
          </div>

          <span className="rounded-full bg-(--surface) px-2 py-1 text-xs text-(--text-muted)">
            {categories.length}
          </span>
        </div>

        <div className="mt-3 flex min-w-0 gap-2">
          <label
            htmlFor="manager-new-category"
            className="sr-only"
          >
            New category name
          </label>
          <input
            id="manager-new-category"
            value={newName}
            maxLength={100}
            disabled={controlsBusy}
            onChange={(event) =>
              setNewName(
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
            placeholder="Create category..."
            className="h-10 min-w-0 flex-1 rounded-lg border border-(--border) bg-(--surface) px-2 text-xs outline-none placeholder:text-(--text-faint) focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 xl:h-8"
          />
          <button
            type="button"
            disabled={
              controlsBusy ||
              !newName.trim()
            }
            onClick={() =>
              void handleCreate()
            }
            aria-label="Create category"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 xl:h-8 xl:w-8"
            title="Create category"
          >
            <Plus size={13} aria-hidden="true" />
          </button>
        </div>

        {isLoading && categories.length === 0 ? (
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
              Loading categories
            </span>
          </div>
        ) : categories.length === 0 ? (
          <p
            role="status"
            className="mt-3 rounded-lg border border-dashed border-(--border) p-3 text-xs text-(--text-muted)"
          >
            No categories yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {categories.map(
              (category) => {
                const isEditing =
                  editingId ===
                  category.id;

                return (
                  <div
                    key={category.id}
                    className="flex items-center gap-2 rounded-lg border border-(--border) bg-(--surface) p-2"
                  >
                    {isEditing ? (
                      <>
                        <label
                          htmlFor={`category-name-${category.id}`}
                          className="sr-only"
                        >
                          Category name
                        </label>
                        <input
                          id={`category-name-${category.id}`}
                          autoFocus
                          value={editingName}
                          maxLength={100}
                          disabled={controlsBusy}
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
                                category.id,
                              );
                            }

                            if (
                              event.key === "Escape"
                            ) {
                              cancelEditing();
                            }
                          }}
                          className="h-10 min-w-0 flex-1 rounded-lg border border-(--border-strong) bg-(--app-bg) px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 xl:h-8"
                        />
                        <button
                          type="button"
                          disabled={
                            controlsBusy ||
                            !editingName.trim()
                          }
                          onClick={() =>
                            void handleRename(
                              category.id,
                            )
                          }
                          aria-label="Save category name"
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border-strong) text-(--text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-40 xl:h-8 xl:w-8"
                          title="Save"
                        >
                          <Check size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={controlsBusy}
                          onClick={cancelEditing}
                          aria-label="Cancel category rename"
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border-strong) text-(--text-muted) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-40 xl:h-8 xl:w-8"
                          title="Cancel"
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-xs text-(--text-secondary)">
                          {category.name}
                        </span>
                        <button
                          type="button"
                          disabled={controlsBusy}
                          onClick={() =>
                            startEditing(
                              category,
                            )
                          }
                          aria-label={`Rename category ${category.name}`}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-40 xl:h-8 xl:w-8"
                          title="Rename category"
                        >
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          disabled={controlsBusy}
                          onClick={() =>
                            void handleDelete(
                              category,
                            )
                          }
                          aria-label={`Delete category ${category.name}`}
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-40 xl:h-8 xl:w-8"
                          title="Delete category"
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                );
              },
            )}
          </div>
        )}

        {error && !pendingDelete && (
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
            ? `Delete category "${pendingDelete.category.name}"?`
            : "Delete category?"
        }
        description="Deleting a category uncategorizes organized items; the items themselves are preserved."
        details={
          pendingDelete
            ? [
                `${pendingDelete.impact.noteCountToUncategorize} Note(s) will be uncategorized.`,
                `${pendingDelete.impact.taskCountToUncategorize} Task(s) will be uncategorized.`,
                pendingDelete.impact.notesPreserved
                  ? "Notes will be preserved."
                  : "Notes may be affected.",
                pendingDelete.impact.tasksPreserved
                  ? "Tasks will be preserved."
                  : "Tasks may be affected.",
              ]
            : []
        }
        confirmLabel="Delete Category"
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
