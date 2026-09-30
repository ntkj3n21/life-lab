import { SlidersHorizontal, X } from "lucide-react";
import { useId, useState } from "react";

import { FilterDialogShell } from "../../../components/ui/FilterDialogShell";
import type { Tag } from "../services/tagApi";
import { DEFAULT_MEDIA_FILTER, type MediaFilter } from "./mediaFilterState";
import { TagFinderInput } from "./TagFinder";
import { useTagFinder } from "./tagFinding";

interface MediaLibraryFiltersProps {
  media: "image" | "audio";
  tags: Tag[];
  applied: MediaFilter;
  onChange: (next: MediaFilter) => void;
}

const inputClass =
  "min-h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 text-sm text-(--text-secondary) outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus)";

export function MediaLibraryFilters({ media, tags, applied, onChange }: MediaLibraryFiltersProps) {
  const { tagSearch, setTagSearch, visibleTags } = useTagFinder(tags);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MediaFilter>(applied);
  const [error, setError] = useState<string | null>(null);
  const dialogId = useId();

  const chips: Array<{ id: string; label: string }> = [];
  applied.tagIds?.forEach((id) => chips.push({ id: `tag:${id}`, label: tags.find((tag) => tag.id === id)?.name ?? "Selected tag" }));
  if (applied.hasNotes !== undefined) chips.push({ id: "hasNotes", label: applied.hasNotes ? "Has notes" : "No notes" });
  if (applied.origin) chips.push({ id: "origin", label: applied.origin === "UPLOAD" ? "Uploaded" : "External" });
  if (applied.addedFrom) chips.push({ id: "addedFrom", label: `Added from ${applied.addedFrom}` });
  if (applied.addedTo) chips.push({ id: "addedTo", label: `Added to ${applied.addedTo}` });
  if (applied.sortBy === "title") chips.push({ id: "sortBy", label: "Sort by title" });
  if (applied.sortDirection === "asc") chips.push({ id: "sortDirection", label: "Ascending" });

  function openDialog() {
    setDraft({ ...applied, tagIds: [...(applied.tagIds ?? [])] });
    setError(null);
    setOpen(true);
  }

  function apply() {
    if (draft.addedFrom && draft.addedTo && draft.addedFrom > draft.addedTo) {
      setError("Added-from date must be on or before added-to date.");
      return;
    }
    onChange(draft);
    setOpen(false);
  }

  function removeChip(id: string) {
    if (id.startsWith("tag:")) {
      const tagId = Number(id.slice(4));
      onChange({ ...applied, tagIds: applied.tagIds?.filter((value) => value !== tagId) });
    } else {
      onChange({
        ...applied,
        [id]: id === "sortBy" ? "addedAt" : id === "sortDirection" ? "desc" : undefined,
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        className="flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-(--border) px-3 text-xs font-medium text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
      >
        <SlidersHorizontal size={14} aria-hidden="true" />
        Filters{chips.length > 0 ? ` (${chips.length})` : ""}
      </button>

      {chips.length > 0 && (
        <div className="flex w-full flex-wrap items-center gap-2" aria-label={`Applied ${media} filters`}>
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => removeChip(chip.id)}
              aria-label={`Remove ${chip.label} filter`}
              className="flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-(--border) bg-(--surface-subtle) px-3 text-xs text-(--text-secondary) hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
            >
              <span className="truncate">{chip.label}</span><X size={12} aria-hidden="true" />
            </button>
          ))}
          <button type="button" onClick={() => onChange(DEFAULT_MEDIA_FILTER)} className="min-h-9 rounded-lg px-2 text-xs text-(--text-muted) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)">Clear filters</button>
        </div>
      )}

      <FilterDialogShell
        open={open}
        withinMainPane
        dialogId={dialogId}
        title={`${media === "image" ? "Image" : "Audio"} filters`}
        description="Refine the current Library results. Changes apply when you confirm them."
        isBusy={false}
        onDismiss={() => setOpen(false)}
        footer={<>
          <button type="button" onClick={() => { setDraft(DEFAULT_MEDIA_FILTER); setError(null); }} className="min-h-10 rounded-lg px-3 text-sm text-(--text-muted) hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)">Reset</button>
          <div className="ml-auto flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg border border-(--border) px-3 text-sm text-(--text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)">Cancel</button>
            <button type="button" onClick={apply} className="min-h-10 rounded-lg bg-(--primary-bg) px-4 text-sm font-medium text-(--primary-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)">Apply filters</button>
          </div>
        </>}
      >
        {error && <p role="alert" className="text-sm text-(--danger-text)">{error}</p>}
        <p className="text-xs font-medium text-(--text-secondary)">Primary filters</p>
        <fieldset className="rounded-xl border border-(--border) bg-(--surface-subtle) p-3">
          <legend className="px-1 text-xs font-medium text-(--text-secondary)">Personal tags</legend>
          {tags.length === 0 ? <p className="text-xs text-(--text-muted)">No tags available.</p> : (
            <div>
              <TagFinderInput value={tagSearch} onChange={setTagSearch} />
              {visibleTags.length === 0 && <p className="text-xs text-(--text-muted)">No matching tags.</p>}
              <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
              {visibleTags.map((tag) => <label key={tag.id} className="flex items-center gap-2 rounded-lg border border-(--border) px-2.5 py-1.5 text-xs text-(--text-secondary)">
                <input type="checkbox" checked={draft.tagIds?.includes(tag.id) ?? false} onChange={() => setDraft((current) => ({ ...current, tagIds: current.tagIds?.includes(tag.id) ? current.tagIds.filter((id) => id !== tag.id) : [...(current.tagIds ?? []), tag.id] }))} className="accent-(--primary-bg)" />
                {tag.name}
              </label>)}
              </div>
            </div>
          )}
          <p className="mt-2 text-[11px] text-(--text-muted)">Items with any selected tag are shown.</p>
        </fieldset>
        <div className="grid gap-3 @md:grid-cols-2">
          <label className="text-xs font-medium text-(--text-secondary)">Note status
            <select value={draft.hasNotes === undefined ? "" : String(draft.hasNotes)} onChange={(event) => setDraft({ ...draft, hasNotes: event.target.value === "" ? undefined : event.target.value === "true" })} className={`mt-1 ${inputClass}`}>
              <option value="">Any</option><option value="true">Has notes</option><option value="false">No notes</option>
            </select>
          </label>
          <label className="text-xs font-medium text-(--text-secondary)">Origin
            <select value={draft.origin ?? ""} onChange={(event) => setDraft({ ...draft, origin: event.target.value ? event.target.value as MediaFilter["origin"] : undefined })} className={`mt-1 ${inputClass}`}>
              <option value="">Any</option><option value="UPLOAD">Upload</option><option value="EXTERNAL">External</option>
            </select>
          </label>
        </div>
        <details className="rounded-xl border border-(--border) bg-(--app-bg)">
          <summary className="cursor-pointer px-3 py-3 text-xs font-medium text-(--text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)">More filters</summary>
          <div className="grid gap-3 border-t border-(--border) p-3 @md:grid-cols-2">
            <label className="text-xs text-(--text-secondary)">Added from<input type="date" value={draft.addedFrom ?? ""} onChange={(event) => setDraft({ ...draft, addedFrom: event.target.value || undefined })} className={`mt-1 ${inputClass}`} /></label>
            <label className="text-xs text-(--text-secondary)">Added to<input type="date" value={draft.addedTo ?? ""} onChange={(event) => setDraft({ ...draft, addedTo: event.target.value || undefined })} className={`mt-1 ${inputClass}`} /></label>
          </div>
        </details>
        <fieldset className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
          <legend className="px-1 text-xs font-medium text-(--text-secondary)">Sort</legend>
          <div className="grid gap-3 @md:grid-cols-2">
            <label className="text-xs text-(--text-secondary)">Sort by
              <select value={draft.sortBy ?? "addedAt"} onChange={(event) => setDraft({ ...draft, sortBy: event.target.value as MediaFilter["sortBy"] })} className={`mt-1 ${inputClass}`}>
                <option value="addedAt">Added date</option><option value="title">Title</option>
              </select>
            </label>
            <label className="text-xs text-(--text-secondary)">Direction
              <select value={draft.sortDirection ?? "desc"} onChange={(event) => setDraft({ ...draft, sortDirection: event.target.value as MediaFilter["sortDirection"] })} className={`mt-1 ${inputClass}`}>
                <option value="desc">Descending</option><option value="asc">Ascending</option>
              </select>
            </label>
          </div>
        </fieldset>
      </FilterDialogShell>
    </>
  );
}
