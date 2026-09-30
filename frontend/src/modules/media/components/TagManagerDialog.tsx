import { Tag as TagIcon } from "lucide-react";
import { useId, useState } from "react";

import { FilterDialogShell } from "../../../components/ui/FilterDialogShell";
import { TagManager, type TagManagerChange } from "./TagManager";

interface TagManagerDialogProps {
  onChange?: (change: TagManagerChange) => void;
}

export function TagManagerDialog({ onChange }: TagManagerDialogProps) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-(--border) px-3 text-xs font-medium text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
      >
        <TagIcon size={14} aria-hidden="true" />
        Tags
      </button>
      <FilterDialogShell
        open={open}
        dialogId={dialogId}
        title="Manage tags"
        description="Create, rename, or delete personal tags. Assign tags on individual Library items."
        isBusy={false}
        onDismiss={() => setOpen(false)}
        maxWidthClassName="max-w-xl"
        footer={
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-auto min-h-10 rounded-lg border border-(--border) px-4 text-sm text-(--text-secondary) hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
          >
            Done
          </button>
        }
      >
        <TagManager onChange={onChange} />
      </FilterDialogShell>
    </>
  );
}
