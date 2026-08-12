import {
  useEffect,
  useState,
} from "react";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { useContextStore } from "../../../stores/contextStore";
import { useLibraryStore } from "../../../stores/libraryStore";
import { useNoteStore } from "../../../stores/noteStore";
import { useReverseContextNavigation } from "../../context/hooks/useReverseContextNavigation";
import type {
  Note,
  NoteDeleteImpact,
} from "../services/noteApi";
import { NoteCard } from "./NoteCard";
import { QuickNoteComposer } from "./QuickNoteComposer";

interface PendingNoteDelete {
  note: Note;
  impact: NoteDeleteImpact;
}

export function QuickNotePanel() {
  const activeContext = useContextStore(
    (state) => state.activeContext,
  );

  const videos = useLibraryStore(
    (state) => state.videos,
  );

  const notes = useNoteStore(
    (state) => state.notes,
  );

  const videoNotesByVideo = useNoteStore(
    (state) => state.videoNotes,
  );

  const totalElements = useNoteStore(
    (state) => state.totalElements,
  );

  const isLoading = useNoteStore(
    (state) => state.isLoading,
  );

  const isMutating = useNoteStore(
    (state) => state.isMutating,
  );

  const error = useNoteStore(
    (state) => state.error,
  );

  const loadNotes = useNoteStore(
    (state) => state.loadNotes,
  );

  const loadVideoNotes = useNoteStore(
    (state) => state.loadVideoNotes,
  );

  const createNote = useNoteStore(
    (state) => state.createNote,
  );

  const updateNote = useNoteStore(
    (state) => state.updateNote,
  );

  const getDeleteImpact = useNoteStore(
    (state) => state.getDeleteImpact,
  );

  const deleteNote = useNoteStore(
    (state) => state.deleteNote,
  );

  const clearError = useNoteStore(
    (state) => state.clearError,
  );

  const { openNoteContext } =
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
  ] = useState<number | null>(
    null,
  );

  const [
    editingContent,
    setEditingContent,
  ] = useState("");

  const [
    pendingDelete,
    setPendingDelete,
  ] =
    useState<PendingNoteDelete | null>(
      null,
    );

  const [
    isPreparingDelete,
    setIsPreparingDelete,
  ] = useState(false);

  const activeLibraryVideoId =
    activeContext?.entityType ===
      "video" &&
    Number.isFinite(
      Number(activeContext.entityId),
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
    if (
      isMutating ||
      isPreparingDelete
    ) {
      return;
    }

    clearError();
    setIsPreparingDelete(true);

    try {
      const impact =
        await getDeleteImpact(
          note.id,
        );

      setPendingDelete({
        note,
        impact,
      });
    } catch {
      // noteStore keeps error.
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
      await deleteNote(
        pendingDelete.note.id,
      );

      if (
        editingNoteId ===
        pendingDelete.note.id
      ) {
        handleCancelEdit();
      }

      setPendingDelete(null);
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
       * reverseContextStore keeps the API error.
       */
    }
  }

  function renderNote(
    note: Note,
    current: boolean,
  ) {
    return (
      <NoteCard
        key={note.id}
        note={note}
        current={current}
        isMutating={
          isMutating ||
          isPreparingDelete
        }
        isEditing={
          editingNoteId ===
          note.id
        }
        editingContent={
          editingContent
        }
        onEditingContentChange={
          setEditingContent
        }
        onStartEdit={
          handleStartEdit
        }
        onCancelEdit={
          handleCancelEdit
        }
        onSaveEdit={
          handleSaveEdit
        }
        onDelete={
          handleDelete
        }
        onViewSource={
          handleViewSource
        }
      />
    );
  }

  return (
    <>
      <QuickNoteComposer
        hasActiveVideo={Boolean(activeVideo)}
        timestamp={
          activeContext?.timestamp
        }
        content={captureContent}
        includeTimestamp={
          includeTimestamp
        }
        isMutating={isMutating}
        errorMessage={
          error?.message ?? null
        }
        onContentChange={
          setCaptureContent
        }
        onIncludeTimestampChange={
          setIncludeTimestamp
        }
        onCreate={
          handleCreate
        }
      />

      <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-medium">
            Current Video Notes
          </h4>

          <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-500">
            {currentVideoNotes.length}
          </span>
        </div>

        {activeLibraryVideoId ===
        null ? (
          <p className="mt-3 text-sm text-neutral-500">
            No active video.
          </p>
        ) : currentVideoNotes.length ===
          0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No notes for this video yet.
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
        <summary className="cursor-pointer text-sm font-medium text-neutral-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700">
          Recent Notes (
          {totalElements})
        </summary>

        {isLoading &&
        notes.length === 0 ? (
          <p
            role="status"
            className="mt-3 text-sm text-neutral-500"
          >
            Loading notes...
          </p>
        ) : notes.length ===
          0 ? (
          <p
            role="status"
            className="mt-3 text-sm text-neutral-500"
          >
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

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Note?"
        description={
          pendingDelete
            ? `This will delete the selected Note. Its exact YouTube source history is handled according to the impact below.`
            : undefined
        }
        details={
          pendingDelete
            ? [
                `${pendingDelete.impact.taskCountToMarkSourceMissing} linked task(s) will lose their Note source.`,
                pendingDelete.impact.tasksPreserved
                  ? "Linked tasks will be preserved."
                  : "Linked tasks may be affected.",
                pendingDelete.impact.youtubeSourcePreserved
                  ? "The exact YouTube source will be preserved."
                  : "The exact YouTube source may be affected.",
              ]
            : []
        }
        confirmLabel="Delete Note"
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