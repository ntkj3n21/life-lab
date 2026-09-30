import { FolderKanban } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";

import { FilterDialogShell } from "../../../components/ui/FilterDialogShell";
import { useCategoryStore } from "../../../stores/categoryStore";
import { useTagStore } from "../../../stores/tagStore";
import { TagManager, type TagManagerChange } from "../../media/components/TagManager";
import { CategoryManager, type CategoryManagerChange } from "./CategoryManager";

interface OrganizationManagerDialogProps {
  onCategoryChange: (change: CategoryManagerChange) => void;
  onTagChange: (change: TagManagerChange) => void;
}

type ManagerTab = "categories" | "tags";

export function OrganizationManagerDialog({
  onCategoryChange,
  onTagChange,
}: OrganizationManagerDialogProps) {
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<ManagerTab>("categories");
  const categoryTabRef = useRef<HTMLButtonElement | null>(null);
  const tagTabRef = useRef<HTMLButtonElement | null>(null);
  const categoryBusy = useCategoryStore((state) => state.isMutating);
  const tagBusy = useTagStore((state) => state.isMutating);
  const isBusy = categoryBusy || tagBusy;

  function selectTab(tab: ManagerTab) {
    setActiveTab(tab);
    requestAnimationFrame(() => {
      (tab === "categories" ? categoryTabRef : tagTabRef).current?.focus();
    });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, tab: ManagerTab) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(tab === "categories" ? "tags" : "categories");
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      selectTab(event.key === "Home" ? "categories" : "tags");
    }
  }

  function handleCategoryChange(change: CategoryManagerChange) {
    onCategoryChange(change);
    if (change.type === "deleted") {
      requestAnimationFrame(() => categoryTabRef.current?.focus());
    }
  }

  function handleTagChange(change: TagManagerChange) {
    onTagChange(change);
    if (change.type === "deleted") {
      requestAnimationFrame(() => tagTabRef.current?.focus());
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setActiveTab("categories");
          setOpen(true);
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-(--border) px-3 text-sm font-medium text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
      >
        <FolderKanban size={15} aria-hidden="true" />
        Categories &amp; tags
      </button>

      <FilterDialogShell
        open={open}
        dialogId={dialogId}
        title="Categories & tags"
        description="Manage reusable categories and tags. Assign them with Organize on a Note or Task."
        isBusy={isBusy}
        onDismiss={() => setOpen(false)}
        maxWidthClassName="max-w-xl"
        footer={
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={isBusy}
            className="ml-auto min-h-10 rounded-lg border border-(--border) px-4 text-sm text-(--text-secondary) hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
          >
            Done
          </button>
        }
      >
        <div role="tablist" aria-label="Manage organization" className="flex gap-2 border-b border-(--border) pb-3">
          {(["categories", "tags"] as const).map((tab) => (
            <button
              key={tab}
              ref={tab === "categories" ? categoryTabRef : tagTabRef}
              id={`${dialogId}-${tab}-tab`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              aria-controls={`${dialogId}-panel`}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => selectTab(tab)}
              onKeyDown={(event) => handleTabKeyDown(event, tab)}
              className={`min-h-10 rounded-lg border px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${activeTab === tab ? "border-(--border-strong) bg-(--surface-active) text-(--text-primary)" : "border-transparent text-(--text-muted) hover:bg-(--surface-hover)"}`}
            >
              {tab === "categories" ? "Categories" : "Tags"}
            </button>
          ))}
        </div>

        <div
          id={`${dialogId}-panel`}
          role="tabpanel"
          aria-labelledby={`${dialogId}-${activeTab}-tab`}
          className="space-y-3"
        >
          {activeTab === "categories" ? (
            <>
              <p className="text-xs leading-5 text-(--text-muted)">
                Use one main Category to group a Note or Task.
              </p>
              <CategoryManager variant="compact" onChange={handleCategoryChange} />
            </>
          ) : (
            <>
              <p className="text-xs leading-5 text-(--text-muted)">
                Use multiple Tags for flexible details.
              </p>
              <TagManager variant="compact" onChange={handleTagChange} />
            </>
          )}
        </div>
      </FilterDialogShell>
    </>
  );
}
