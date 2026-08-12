import {
  Pencil,
  StickyNote,
  Trash2,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { useContextStore } from "../../../stores/contextStore";
import { useLibraryStore } from "../../../stores/libraryStore";
import { useNoteStore } from "../../../stores/noteStore";

import {
  useReverseContextNavigation,
} from "../../context/hooks/useReverseContextNavigation";

import type {
  Note,
} from "../services/noteApi";

import {
  formatTime,
} from "../../../utils/formatTime";

export function QuickNotePanel() {
  const activeContext =
    useContextStore(
      (state) =>
        state.activeContext,
    );

  const videos =
    useLibraryStore(
      (state) =>
        state.videos,
    );

  const notes =
    useNoteStore(
      (state) =>
        state.notes,
    );

  const videoNotesByVideo =
    useNoteStore(
      (state) =>
        state.videoNotes,
    );

  const totalElements =
    useNoteStore(
      (state) =>
        state.totalElements,
    );

  const isLoading =
    useNoteStore(
      (state) =>
        state.isLoading,
    );

  const isMutating =
    useNoteStore(
      (state) =>
        state.isMutating,
    );

  const error =
    useNoteStore(
      (state) =>
        state.error,
    );

  const loadNotes =
    useNoteStore(
      (state) =>
        state.loadNotes,
    );

  const loadVideoNotes =
    useNoteStore(
      (state) =>
        state.loadVideoNotes,
    );

  const createNote =
    useNoteStore(
      (state) =>
        state.createNote,
    );

  const updateNote =
    useNoteStore(
      (state) =>
        state.updateNote,
    );

  const getDeleteImpact =
    useNoteStore(
      (state) =>
        state.getDeleteImpact,
    );

  const deleteNote =
    useNoteStore(
      (state) =>
        state.deleteNote,
    );

  const clearError =
    useNoteStore(
      (state) =>
        state.clearError,
    );

  const {
    openNoteContext,
  } =
    useReverseContextNavigation();

  const [
    captureContent,
    setCaptureContent,
  ] = useState("");

  const [
    includeTimestamp,
    setIncludeTimestamp,
  ] = useState(true);

  const [
    editingNoteId,
    setEditingNoteId,
  ] = useState<
    number | null
  >(null);

  const [
    editingContent,
    setEditingContent,
  ] = useState("");

  const activeLibraryVideoId =
    activeContext?.entityType ===
      "video" &&
    Number.isFinite(
      Number(
        activeContext.entityId,
      ),
    )
      ? Number(
          activeContext.entityId,
        )
      : null;

  const activeVideo =
    activeLibraryVideoId !== null
      ? videos.find(
          (video) =>
            video.id ===
            activeLibraryVideoId,
        )
      : undefined;

  const currentVideoNotes =
    activeLibraryVideoId !== null
      ? videoNotesByVideo[
          activeLibraryVideoId
        ] ?? []
      : [];

  useEffect(() => {
    void loadNotes({
      page: 0,
      size: 20,
    }).catch(() => {
      // noteStore keeps error.
    });
  }, [loadNotes]);

  useEffect(() => {
    if (
      activeLibraryVideoId ===
      null
    ) {
      return;
    }

    void loadVideoNotes(
      activeLibraryVideoId,
    ).catch(() => {
      // noteStore keeps error.
    });
  }, [
    activeLibraryVideoId,
    loadVideoNotes,
  ]);

  async function handleCreate() {
    const content =
      captureContent.trim();

    if (
      !content ||
      activeLibraryVideoId ===
        null ||
      isMutating
    ) {
      return;
    }

    clearError();

    const timestampSeconds =
      includeTimestamp &&
      typeof activeContext
        ?.timestamp === "number"
        ? Math.max(
            0,
            Math.floor(
              activeContext.timestamp,
            ),
          )
        : null;

    try {
      await createNote(
        activeLibraryVideoId,
        {
          content,

          timestampSeconds,

          withoutTimestampConfirmed:
            timestampSeconds ===
            null,
        },
      );

      setCaptureContent("");
    } catch {
      // noteStore keeps error.
    }
  }

  function handleStartEdit(
    note: Note,
  ) {
    clearError();

    setEditingNoteId(
      note.id,
    );

    setEditingContent(
      note.content,
    );
  }

  function handleCancelEdit() {
    setEditingNoteId(
      null,
    );

    setEditingContent(
      "",
    );
  }

  async function handleSaveEdit(
    noteId: number,
  ) {
    const content =
      editingContent.trim();

    if (
      !content ||
      isMutating
    ) {
      return;
    }

    try {
      await updateNote(
        noteId,
        content,
      );

      handleCancelEdit();
    } catch {
      // noteStore keeps error.
    }
  }

  async function handleDelete(
    note: Note,
  ) {
    if (isMutating) {
      return;
    }

    clearError();

    try {
      const impact =
        await getDeleteImpact(
          note.id,
        );

      const confirmed =
        window.confirm(
          [
            "Delete this note?",
            "",
            `${impact.taskCountToMarkSourceMissing} linked task(s) will lose their Note source.`,
            impact.tasksPreserved
              ? "Tasks will be preserved."
              : "Tasks may be affected.",
            impact.youtubeSourcePreserved
              ? "The YouTube source will be preserved."
              : "The YouTube source may be affected.",
          ].join("\n"),
        );

      if (!confirmed) {
        return;
      }

      await deleteNote(
        note.id,
      );
    } catch {
      // noteStore keeps error.
    }
  }

  async function handleViewSource(
    noteId: number,
  ) {
    try {
      await openNoteContext(
        noteId,
      );
    } catch {
      /*
       * reverseContextStore
       * keeps the API error.
       */
    }
  }

  function renderNote(
    note: Note,
    current: boolean,
  ) {
    return (
      <article
        key={note.id}
        className={`rounded-xl border p-3 ${
          current
            ? "border-neutral-700 bg-neutral-900"
            : "border-neutral-800 bg-neutral-900"
        }`}
      >
        {editingNoteId ===
        note.id ? (
          <>
            <textarea
              value={
                editingContent
              }
              disabled={
                isMutating
              }
              onChange={(
                event,
              ) =>
                setEditingContent(
                  event.target
                    .value,
                )
              }
              className="h-28 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm outline-none focus:border-neutral-600"
            />

            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={
                  handleCancelEdit
                }
                disabled={
                  isMutating
                }
                className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:opacity-40"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void handleSaveEdit(
                    note.id,
                  )
                }
                disabled={
                  isMutating ||
                  !editingContent.trim()
                }
                className="rounded-lg bg-white px-3 py-1 text-xs font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-2">
              <StickyNote
                size={15}
                className="mt-0.5 shrink-0 text-neutral-500"
              />

              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-neutral-300">
                {note.content}
              </p>
            </div>

            <div className="mt-3 text-xs text-neutral-500">
              <p className="line-clamp-1">
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

            <div className="mt-3 flex items-center justify-between gap-2">
              <div>
                {current && (
                  <span className="rounded-full bg-neutral-800 px-2 py-1 text-[10px] text-neutral-400">
                    CURRENT
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void handleViewSource(
                      note.id,
                    )
                  }
                  className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
                >
                  View Source
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleStartEdit(
                      note,
                    )
                  }
                  disabled={
                    isMutating
                  }
                  className="rounded-lg border border-neutral-800 p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white disabled:opacity-40"
                  title="Edit note"
                >
                  <Pencil
                    size={13}
                  />
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void handleDelete(
                      note,
                    )
                  }
                  disabled={
                    isMutating
                  }
                  className="rounded-lg border border-neutral-800 p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-300 disabled:opacity-40"
                  title="Delete note"
                >
                  <Trash2
                    size={13}
                  />
                </button>
              </div>
            </div>
          </>
        )}
      </article>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-medium text-neutral-300">
              Quick Note
            </h4>

            <p className="mt-1 text-xs text-neutral-500">
              Save a note to the
              exact current video
              source.
            </p>
          </div>

          {activeContext &&
            typeof activeContext
              .timestamp ===
              "number" && (
              <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-500">
                {formatTime(
                  activeContext.timestamp,
                )}
              </span>
            )}
        </div>

        {!activeVideo && (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-800 p-3 text-xs text-neutral-500">
            Open a Library video
            before creating a
            note.
          </p>
        )}

        <textarea
          value={
            captureContent
          }
          disabled={
            !activeVideo ||
            isMutating
          }
          onChange={(
            event,
          ) =>
            setCaptureContent(
              event.target.value,
            )
          }
          placeholder="Write your note..."
          className="mt-3 h-32 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600 disabled:opacity-50"
        />

        <label className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
          <input
            type="checkbox"
            checked={
              includeTimestamp
            }
            disabled={
              !activeVideo
            }
            onChange={(
              event,
            ) =>
              setIncludeTimestamp(
                event.target
                  .checked,
              )
            }
          />

          Include current
          timestamp
        </label>

        <button
          type="button"
          onClick={() =>
            void handleCreate()
          }
          disabled={
            !activeVideo ||
            isMutating ||
            !captureContent.trim()
          }
          className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMutating
            ? "Saving..."
            : "Save Note"}
        </button>

        {error && (
          <p className="mt-2 text-xs text-red-400">
            {error.message}
          </p>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-medium">
            Current Video Notes
          </h4>

          <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-500">
            {
              currentVideoNotes.length
            }
          </span>
        </div>

        {activeLibraryVideoId ===
        null ? (
          <p className="mt-3 text-sm text-neutral-500">
            No active video.
          </p>
        ) : currentVideoNotes
            .length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No notes for this
            video yet.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {currentVideoNotes.map(
              (note) =>
                renderNote(
                  note,
                  true,
                ),
            )}
          </div>
        )}
      </div>

      <details className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <summary className="cursor-pointer text-sm font-medium text-neutral-300">
          Recent Notes (
          {totalElements})
        </summary>

        {isLoading &&
        notes.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            Loading notes...
          </p>
        ) : notes.length ===
          0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No notes yet.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {notes.map(
              (note) =>
                renderNote(
                  note,
                  false,
                ),
            )}
          </div>
        )}
      </details>
    </>
  );
}