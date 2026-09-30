import { useEffect, useRef, useState } from "react";

import { useTagStore } from "../../../stores/tagStore";
import { TagFinderInput } from "../../media/components/TagFinder";
import { useTagFinder } from "../../media/components/tagFinding";
import type { Note } from "../services/noteApi";

interface WorkspaceNoteTagsEditorProps {
  note: Note;
  isBusy: boolean;
  errorMessage: string | null;
  onSave: (tagIds: number[]) => Promise<void>;
  onCancel: () => void;
}

export function WorkspaceNoteTagsEditor({
  note,
  isBusy,
  errorMessage,
  onSave,
  onCancel,
}: WorkspaceNoteTagsEditorProps) {
  const tags = useTagStore((state) => state.tags);
  const hasLoadedTags = useTagStore((state) => state.hasLoadedTags);
  const isLoading = useTagStore((state) => state.isLoading);
  const loadError = useTagStore((state) => state.error);
  const loadTags = useTagStore((state) => state.loadTags);
  const [selectedIds, setSelectedIds] = useState<number[]>(
    note.tags.map((tag) => tag.id),
  );
  const { tagSearch, setTagSearch, visibleTags } = useTagFinder(tags);
  const sectionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    sectionRef.current?.focus();
  }, []);

  useEffect(() => {
    void loadTags().catch(() => {
      // The Tag store exposes the recoverable error below.
    });
  }, [loadTags]);

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label={`Manage tags for Note ${note.id}`}
      aria-busy={isBusy || isLoading}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !isBusy) onCancel();
      }}
      className="mt-2 rounded-xl border border-(--border-strong) bg-(--app-bg) p-3"
    >
      <p className="text-xs font-medium text-(--text-secondary)">Tags</p>
      {!hasLoadedTags && isLoading ? (
        <p role="status" className="mt-2 text-xs text-(--text-muted)">
          Loading tags...
        </p>
      ) : !hasLoadedTags && loadError ? (
        <div className="mt-2">
          <p role="alert" className="text-xs text-(--danger-text)">
            {loadError.message}
          </p>
          <button
            type="button"
            onClick={() => void loadTags().catch(() => {})}
            className="mt-2 min-h-10 rounded-lg border border-(--border) px-3 text-xs text-(--text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
          >
            Retry
          </button>
        </div>
      ) : tags.length === 0 ? (
        <p className="mt-2 text-xs text-(--text-muted)">
          No tags yet. Create one from Notes or Library.
        </p>
      ) : (
        <div className="mt-2">
        <TagFinderInput value={tagSearch} onChange={setTagSearch} disabled={isBusy} />
        {visibleTags.length === 0 && <p className="text-xs text-(--text-muted)">No matching tags.</p>}
        <fieldset className="max-h-40 space-y-1 overflow-y-auto">
          <legend className="sr-only">Choose tags</legend>
          {visibleTags.map((tag) => (
            <label
              key={tag.id}
              className="flex min-h-9 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs text-(--text-secondary) hover:bg-(--surface-hover)"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(tag.id)}
                disabled={isBusy}
                onChange={() =>
                  setSelectedIds((current) =>
                    current.includes(tag.id)
                      ? current.filter((id) => id !== tag.id)
                      : [...current, tag.id],
                  )
                }
                className="h-4 w-4 shrink-0 accent-(--primary-bg)"
              />
              <span className="min-w-0 truncate" title={tag.name}>
                {tag.name}
              </span>
            </label>
          ))}
        </fieldset>
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="mt-2 text-xs text-(--danger-text)">
          {errorMessage}
        </p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          disabled={isBusy}
          onClick={onCancel}
          className="min-h-10 rounded-lg px-3 text-xs text-(--text-muted) hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isBusy || !hasLoadedTags || isLoading}
          onClick={() => void onSave(selectedIds)}
          className="min-h-10 rounded-lg bg-(--primary-bg) px-3 text-xs font-medium text-(--primary-text) hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
        >
          {isBusy ? "Saving..." : "Save tags"}
        </button>
      </div>
    </section>
  );
}
