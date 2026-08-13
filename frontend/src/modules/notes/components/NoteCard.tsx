import {
  Eye,
  Pencil,
  StickyNote,
  Trash2,
} from "lucide-react";

import { formatTime } from "../../../utils/formatTime";
import type { Note } from "../services/noteApi";

interface NoteCardProps {
  note: Note;
  current: boolean;

  isMutating: boolean;
  isEditing: boolean;
  editingContent: string;

  onEditingContentChange: (value: string) => void;
  onStartEdit: (note: Note) => void;
  onCancelEdit: () => void;
  onSaveEdit: (noteId: number) => Promise<void>;
  onDelete: (note: Note) => Promise<void>;
  onViewSource: (noteId: number) => Promise<void>;

  onOpenDetail?: (noteId: number) => void;
}

export function NoteCard({
  note,
  current,
  isMutating,
  isEditing,
  editingContent,
  onEditingContentChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onViewSource,
  onOpenDetail,
}: NoteCardProps) {
  const contentId =
    `note-content-${note.id}`;

  return (
    <article
      aria-busy={isMutating}
      className={`rounded-xl border p-3 ${
        current
          ? "border-(--border-strong) bg-(--surface)"
          : "border-(--border) bg-(--surface)"
      }`}
    >
      {isEditing ? (
        <>
          <label
            htmlFor={contentId}
            className="sr-only"
          >
            Note content
          </label>

          <textarea
            id={contentId}
            value={editingContent}
            disabled={isMutating}
            onChange={(event) =>
              onEditingContentChange(
                event.target.value,
              )
            }
            className="h-28 w-full resize-none rounded-xl border border-(--border) bg-(--app-bg) p-3 text-sm outline-none focus:border-(--border-strong) focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
          />

          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onCancelEdit}
              disabled={isMutating}
              className="rounded-lg border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() =>
                void onSaveEdit(
                  note.id,
                )
              }
              disabled={
                isMutating ||
                !editingContent.trim()
              }
              className="rounded-lg bg-(--primary-bg) px-3 py-1 text-xs font-medium text-(--primary-text) hover:bg-(--primary-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isMutating
                ? "Saving..."
                : "Save"}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-start gap-2">
            <StickyNote
              size={15}
              className="mt-0.5 shrink-0 text-(--text-muted)"
              aria-hidden="true"
            />

            <p className="min-w-0 whitespace-pre-wrap wrap-break-word text-sm leading-6 text-(--text-secondary)">
              {note.content}
            </p>
          </div>

          <div className="mt-3 min-w-0 text-xs text-(--text-muted)">
            <p
              className="truncate"
              title={
                note.youtubeSource
                  .title ??
                note.youtubeSource
                  .youtubeVideoId
              }
            >
              {note.youtubeSource
                .title ??
                note.youtubeSource
                  .youtubeVideoId}
            </p>

            <p className="mt-1">
              {note.timestampSeconds !==
              null
                ? formatTime(
                    note.timestampSeconds,
                  )
                : "No timestamp"}
            </p>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              {current && (
                <span className="rounded-full bg-(--surface-hover) px-2 py-1 text-[10px] text-(--text-secondary)">
                  Current
                </span>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {onOpenDetail && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenDetail(
                      note.id,
                    )
                  }
                  disabled={isMutating}
                  className="flex items-center gap-1.5 rounded-lg border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Eye
                    size={12}
                    aria-hidden="true"
                  />
                  Details
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  void onViewSource(
                    note.id,
                  )
                }
                disabled={isMutating}
                className="rounded-lg border border-(--border) px-2 py-1 text-xs text-(--text-secondary) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
              >
                View Source
              </button>

              <button
                type="button"
                onClick={() =>
                  onStartEdit(note)
                }
                disabled={isMutating}
                aria-label={`Edit Note ${note.id}`}
                className="rounded-lg border border-(--border) p-1.5 text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                title="Edit note"
              >
                <Pencil
                  size={13}
                  aria-hidden="true"
                />
              </button>

              <button
                type="button"
                onClick={() =>
                  void onDelete(note)
                }
                disabled={isMutating}
                aria-label={`Delete Note ${note.id}`}
                className="rounded-lg border border-(--border) p-1.5 text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--danger-text) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40"
                title="Delete note"
              >
                <Trash2
                  size={13}
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        </>
      )}
    </article>
  );
}
