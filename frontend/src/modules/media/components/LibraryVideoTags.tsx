import { X } from "lucide-react";

import { useTagStore } from "../../../stores/tagStore";
import type { Tag } from "../services/tagApi";
import { TagFinderInput } from "./TagFinder";
import { useTagFinder } from "./tagFinding";

interface LibraryVideoTagsProps {
  libraryVideoId: number;
  attachedTags: Tag[];
  onChanged: () => void;
}

export function LibraryVideoTags({ libraryVideoId, attachedTags, onChanged }: LibraryVideoTagsProps) {
  const catalog = useTagStore((state) => state.tags);
  const isMutating = useTagStore((state) => state.isMutating);
  const error = useTagStore((state) => state.error);
  const attachTag = useTagStore((state) => state.attachTag);
  const detachTag = useTagStore((state) => state.detachTag);
  const clearError = useTagStore((state) => state.clearError);

  const attachedIds = new Set(attachedTags.map((tag) => tag.id));
  const availableTags = catalog.filter((tag) => !attachedIds.has(tag.id));
  const { tagSearch, setTagSearch, visibleTags } = useTagFinder(availableTags);

  async function changeTag(tagId: number, attach: boolean) {
    if (isMutating) return;
    clearError();
    try {
      if (attach) await attachTag(libraryVideoId, tagId);
      else await detachTag(libraryVideoId, tagId);
      onChanged();
    } catch {
      // tagStore keeps the actionable error.
    }
  }

  return (
    <section aria-label="Video tag assignment" aria-busy={isMutating} className="mt-2 min-w-0">
      {attachedTags.length > 0 ? (
        <div className="flex min-w-0 flex-wrap gap-1.5">
          {attachedTags.map((tag) => {
            const name = catalog.find((entry) => entry.id === tag.id)?.name ?? tag.name;
            return (
              <span key={tag.id} className="flex max-w-full min-w-0 items-center gap-1 rounded-full border border-(--border) bg-(--surface-subtle) px-2 text-[11px] font-medium text-(--text-primary)">
                <span className="truncate" title={name}>{name}</span>
                <button
                  type="button"
                  disabled={isMutating}
                  onClick={() => void changeTag(tag.id, false)}
                  aria-label={`Remove tag ${name}`}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--text-muted) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
                ><X size={12} aria-hidden="true" /></button>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-(--text-muted)">No tags assigned.</p>
      )}

      {availableTags.length > 0 && (
        <>
        <TagFinderInput value={tagSearch} onChange={setTagSearch} disabled={isMutating} />
        {visibleTags.length === 0 && <p className="text-xs text-(--text-muted)">No matching tags.</p>}
        <label className="mt-2 block text-xs text-(--text-secondary)">Assign tag
          <select
            defaultValue=""
            disabled={isMutating}
            onChange={(event) => {
              const tagId = Number(event.target.value);
              if (tagId) void changeTag(tagId, true);
              event.target.value = "";
            }}
            className="mt-1 min-h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-2 text-xs text-(--text-secondary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"
          >
            <option value="">Choose an existing tag...</option>
            {visibleTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}
          </select>
        </label>
        </>
      )}

      {error && <p role="alert" className="mt-2 wrap-break-word text-xs text-(--danger-text)">{error.message}</p>}
    </section>
  );
}
