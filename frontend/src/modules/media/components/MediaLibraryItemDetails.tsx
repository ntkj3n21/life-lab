import { Ellipsis, LoaderCircle, Pencil, Tag as TagIcon, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { Tag } from "../services/tagApi";
import { TagFinderInput } from "./TagFinder";
import { useTagFinder } from "./tagFinding";

interface MediaItem {
  id: number;
  title: string | null;
  personalDescription: string | null;
  tags: Tag[];
}

interface MediaLibraryItemDetailsProps {
  media: "image" | "audio";
  item: MediaItem;
  displayTitle: string;
  addedLabel: string;
  catalog: Tag[];
  onSave: (id: number, input: { title: string | null; personalDescription: string | null }) => Promise<void>;
  onAttach: (id: number, tagId: number) => Promise<void>;
  onDetach: (id: number, tagId: number) => Promise<void>;
  onRemove: () => void;
}

export function MediaLibraryItemDetails({
  media,
  item,
  displayTitle,
  addedLabel,
  catalog,
  onSave,
  onAttach,
  onDetach,
  onRemove,
}: MediaLibraryItemDetailsProps) {
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const actionsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [disclosure, setDisclosure] = useState<"edit" | "tags" | null>(null);
  const [title, setTitle] = useState(item.title ?? "");
  const [description, setDescription] = useState(item.personalDescription ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!actionsOpen && disclosure === null) return;

    function handlePointerDown(event: PointerEvent) {
      if (actionsOpen && event.target instanceof Node && !actionsRef.current?.contains(event.target)) {
        setActionsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || busy) return;
      if (actionsOpen || disclosure !== null) {
        setActionsOpen(false);
        setDisclosure(null);
        setError(null);
        window.requestAnimationFrame(() => actionsTriggerRef.current?.focus());
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionsOpen, disclosure, busy]);

  const availableTags = catalog.filter((tag) => !item.tags.some((assigned) => assigned.id === tag.id));
  const { tagSearch, setTagSearch, visibleTags } = useTagFinder(availableTags);

  function restoreTriggerFocus() {
    window.requestAnimationFrame(() => actionsTriggerRef.current?.focus());
  }

  function closeDisclosure() {
    setDisclosure(null);
    setError(null);
    restoreTriggerFocus();
  }

  function startEdit() {
    setTitle(item.title ?? "");
    setDescription(item.personalDescription ?? "");
    setError(null);
    setActionsOpen(false);
    setDisclosure("edit");
  }

  function startTags() {
    setError(null);
    setActionsOpen(false);
    setDisclosure("tags");
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // PATCH carries both fields. Always send both current form values.
      await onSave(item.id, { title: title.trim() || null, personalDescription: description.trim() || null });
      closeDisclosure();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save details.");
    } finally {
      setBusy(false);
    }
  }

  async function changeTag(tagId: number, attach: boolean) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (attach) await onAttach(item.id, tagId);
      else await onDetach(item.id, tagId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update tags.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div aria-busy={busy} className="min-w-0">
      {disclosure === null && (
        <>
          {item.personalDescription && (
            <p className="mt-2 line-clamp-2 wrap-break-word text-xs leading-5 text-(--text-secondary)" title={item.personalDescription}>
              {item.personalDescription}
            </p>
          )}
          {item.tags.length > 0 && (
            <div className="mt-2 flex min-w-0 flex-wrap gap-1.5" aria-label={`${media} tags`}>
              {item.tags.map((tag) => {
                const name = catalog.find((entry) => entry.id === tag.id)?.name ?? tag.name;
                return <span key={tag.id} title={name} className="max-w-full truncate rounded-full border border-(--border) bg-(--surface-subtle) px-2 py-1 text-[11px] font-medium text-(--text-primary)">{name}</span>;
              })}
            </div>
          )}
        </>
      )}

      {disclosure === "edit" && (
        <div className="mt-3 space-y-2 border-t border-(--border) pt-3">
          <label className="block text-xs font-medium text-(--text-secondary)">Title
            <input autoFocus value={title} maxLength={255} disabled={busy} onChange={(event) => setTitle(event.target.value)} placeholder={`Optional ${media} title`} className="mt-1 min-h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-3 text-sm text-(--text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50" />
          </label>
          <label className="block text-xs font-medium text-(--text-secondary)">Description
            <textarea value={description} maxLength={2000} rows={3} disabled={busy} onChange={(event) => setDescription(event.target.value)} placeholder="Optional description" className="mt-1 w-full resize-y rounded-lg border border-(--border) bg-(--surface) px-3 py-2 text-sm text-(--text-primary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50" />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={busy} onClick={closeDisclosure} className="min-h-10 rounded-lg border border-(--border) px-3 text-xs text-(--text-secondary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void save()} className="flex min-h-10 items-center gap-2 rounded-lg bg-(--primary-bg) px-3 text-xs font-medium text-(--primary-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)">{busy && <LoaderCircle size={13} className="animate-spin" aria-hidden="true" />}{busy ? "Saving..." : "Save"}</button>
          </div>
        </div>
      )}

      {disclosure === "tags" && (
        <section aria-label={`${media} tag assignment`} className="mt-3 min-w-0 border-t border-(--border) pt-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-(--text-secondary)">Tags</span>
            <button type="button" autoFocus disabled={busy} onClick={closeDisclosure} aria-label="Close tag assignment" className="flex h-9 w-9 items-center justify-center rounded-lg text-(--text-muted) hover:bg-(--surface-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"><X size={14} aria-hidden="true" /></button>
          </div>
          {item.tags.length > 0 ? (
            <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
              {item.tags.map((tag) => {
                const name = catalog.find((entry) => entry.id === tag.id)?.name ?? tag.name;
                return <span key={tag.id} className="flex max-w-full min-w-0 items-center gap-1 rounded-full border border-(--border) bg-(--surface-subtle) px-2 text-[11px] font-medium text-(--text-primary)"><span className="truncate" title={name}>{name}</span><button type="button" disabled={busy} onClick={() => void changeTag(tag.id, false)} aria-label={`Remove tag ${name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-(--text-muted) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"><X size={12} aria-hidden="true" /></button></span>;
              })}
            </div>
          ) : <p className="mt-2 text-xs text-(--text-muted)">No tags assigned.</p>}
          {availableTags.length > 0 && <>
            <TagFinderInput value={tagSearch} onChange={setTagSearch} disabled={busy} />
            {visibleTags.length === 0 && <p className="text-xs text-(--text-muted)">No matching tags.</p>}
            <label className="mt-2 block text-xs text-(--text-secondary)">Assign tag
              <select defaultValue="" disabled={busy} onChange={(event) => { const id = Number(event.target.value); if (id) void changeTag(id, true); event.target.value = ""; }} className="mt-1 min-h-10 w-full rounded-lg border border-(--border) bg-(--surface) px-2 text-xs text-(--text-secondary) outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50"><option value="">Choose an existing tag...</option>{visibleTags.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</select>
            </label>
          </>}
        </section>
      )}

      {error && <p role="alert" className="mt-2 text-xs text-(--danger-text)">{error}</p>}

      <div className="mt-3 flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-[11px] text-(--text-muted)">{addedLabel}</span>
        <div ref={actionsRef} className="relative shrink-0">
          <button
            ref={actionsTriggerRef}
            type="button"
            disabled={busy || disclosure !== null}
            onClick={() => setActionsOpen((open) => !open)}
            aria-expanded={actionsOpen}
            aria-controls={`${media}-library-actions-${item.id}`}
            aria-label={`More actions for ${displayTitle}`}
            title="More actions"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:opacity-50 sm:h-7 sm:w-7"
          ><Ellipsis size={16} aria-hidden="true" /></button>
          {actionsOpen && (
            <div id={`${media}-library-actions-${item.id}`} role="group" aria-label={`Actions for ${displayTitle}`} className="absolute bottom-12 right-0 z-10 w-48 max-w-[calc(100vw-2rem)] rounded-xl border border-(--border-strong) bg-(--surface) p-2 shadow-lg sm:bottom-9">
              <button type="button" onClick={startEdit} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"><Pencil size={13} aria-hidden="true" />Edit</button>
              <button type="button" onClick={startTags} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"><TagIcon size={13} aria-hidden="true" />Tags</button>
              <button type="button" onClick={() => { setActionsOpen(false); actionsTriggerRef.current?.focus(); onRemove(); }} className="flex min-h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-xs text-(--text-secondary) hover:bg-(--danger-surface) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"><Trash2 size={13} aria-hidden="true" />Remove</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
