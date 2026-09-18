import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ChevronDown } from "lucide-react";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ApiError } from "../../../lib/api";
import {
  getWorkspaceSource,
  useContextStore,
} from "../../../stores/contextStore";
import { useNoteStore } from "../../../stores/noteStore";
import { useLayoutStore } from "../../../stores/layoutStore";
import { useWorkspaceStore } from "../../../stores/workspaceStore";
import { useReverseContextNavigation } from "../../context/hooks/useReverseContextNavigation";
import type { Note, NoteDeleteImpact } from "../services/noteApi";
import { NoteCard } from "./NoteCard";
import { QuickNoteComposer } from "./QuickNoteComposer";

interface PendingNoteDelete {
  note: Note;
  impact: NoteDeleteImpact;
}

interface ContextError {
  sourceKey: string | null;
  message: string;
}

function getErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Something went wrong.";
}

export function QuickNotePanel() {
  const navigate = useNavigate();

  const openRightPanel = useLayoutStore((state) => state.openRightPanel);

  const beginTaskFromNote = useWorkspaceStore(
    (state) => state.beginTaskFromNote,
  );

  const activeContext = useContextStore((state) => state.activeContext);

  const notes = useNoteStore((state) => state.notes);

  const workspaceNotes = useNoteStore((state) => state.workspaceNotes);

  const totalElements = useNoteStore((state) => state.totalElements);

  const notesLoadStatus = useNoteStore((state) => state.notesLoadStatus);

  const isMutating = useNoteStore((state) => state.isMutating);

  const notesLoadError = useNoteStore((state) => state.notesLoadError);

  const workspaceNotesLoadStatus = useNoteStore(
    (state) => state.workspaceNotesLoadStatus,
  );

  const workspaceNotesLoadErrors = useNoteStore(
    (state) => state.workspaceNotesLoadErrors,
  );

  const loadNotes = useNoteStore((state) => state.loadNotes);

  const loadWorkspaceNotes = useNoteStore((state) => state.loadWorkspaceNotes);

  const createWorkspaceNote = useNoteStore(
    (state) => state.createWorkspaceNote,
  );

  const updateNote = useNoteStore((state) => state.updateNote);

  const getDeleteImpact = useNoteStore((state) => state.getDeleteImpact);

  const deleteNote = useNoteStore((state) => state.deleteNote);

  const clearError = useNoteStore((state) => state.clearError);

  const { openNoteContext } = useReverseContextNavigation();

  const [captureContent, setCaptureContent] = useState("");

  const [includeTimestamp, setIncludeTimestamp] = useState(true);

  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);

  const [editingContent, setEditingContent] = useState("");

  const [pendingDelete, setPendingDelete] = useState<PendingNoteDelete | null>(
    null,
  );

  const [isPreparingDelete, setIsPreparingDelete] = useState(false);

  const [createError, setCreateError] = useState<ContextError | null>(null);

  const [actionError, setActionError] = useState<ContextError | null>(null);

  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(
    null,
  );

  const activeSource = getWorkspaceSource(activeContext);
  const activeSourceKey = activeSource?.key ?? null;
  const activeSourceType = activeSource?.entityType ?? null;
  const activeSourceLibraryId = activeSource?.libraryId ?? null;

  const previousActiveSourceKey = useRef(activeSourceKey);

  const currentSourceNotes =
    activeSourceKey !== null ? (workspaceNotes[activeSourceKey] ?? []) : [];

  const currentSourceLoadStatus =
    activeSourceKey !== null
      ? (workspaceNotesLoadStatus[activeSourceKey] ?? "idle")
      : "idle";

  const currentSourceLoadError =
    activeSourceKey !== null
      ? (workspaceNotesLoadErrors[activeSourceKey] ?? null)
      : null;

  const createErrorMessage =
    createError?.sourceKey === activeSourceKey ? createError.message : null;

  const actionErrorMessage =
    actionError?.sourceKey === activeSourceKey ? actionError.message : null;

  useEffect(() => {
    if (previousActiveSourceKey.current === activeSourceKey) {
      return;
    }

    previousActiveSourceKey.current = activeSourceKey;

    setCaptureContent("");
    setIncludeTimestamp(true);
    setEditingNoteId(null);
    setEditingContent("");
    setPendingDelete(null);
    setCreateError(null);
    setActionError(null);
    setDeleteErrorMessage(null);
  }, [activeSourceKey]);

  useEffect(() => {
    void loadNotes({
      page: 0,
      size: 20,
    }).catch(() => {
      // noteStore keeps error.
    });
  }, [loadNotes]);

  useEffect(() => {
    if (activeSourceType === null || activeSourceLibraryId === null) {
      return;
    }

    void loadWorkspaceNotes({
      entityType: activeSourceType,
      libraryId: activeSourceLibraryId,
    }).catch(() => {
      // noteStore keeps error.
    });
  }, [
    activeSourceKey,
    activeSourceType,
    activeSourceLibraryId,
    loadWorkspaceNotes,
  ]);

  async function handleCreate() {
    const content = captureContent.trim();

    if (!content || activeSource === null || isMutating) {
      return;
    }

    clearError();
    setCreateError(null);

    const timestampSeconds =
      includeTimestamp && typeof activeContext?.timestamp === "number"
        ? Math.max(0, Math.floor(activeContext.timestamp))
        : null;

    try {
      await createWorkspaceNote(
        {
          entityType: activeSource.entityType,
          libraryId: activeSource.libraryId,
        },
        {
          content,
          timestampSeconds,
          withoutTimestampConfirmed: timestampSeconds === null,
        },
      );

      setCaptureContent("");
    } catch (error) {
      setCreateError({
        sourceKey: activeSourceKey,
        message: getErrorMessage(error),
      });
    }
  }

  function handleStartEdit(note: Note) {
    clearError();
    setActionError(null);

    setEditingNoteId(note.id);

    setEditingContent(note.content);
  }

  function handleCancelEdit() {
    setEditingNoteId(null);

    setEditingContent("");
  }

  async function handleSaveEdit(noteId: number) {
    const content = editingContent.trim();

    if (!content || isMutating) {
      return;
    }

    setActionError(null);

    try {
      await updateNote(noteId, content);

      handleCancelEdit();
    } catch (error) {
      setActionError({
        sourceKey: activeSourceKey,
        message: getErrorMessage(error),
      });
    }
  }

  async function handleDelete(note: Note) {
    if (isMutating || isPreparingDelete) {
      return;
    }

    clearError();
    setActionError(null);
    setDeleteErrorMessage(null);
    setIsPreparingDelete(true);

    try {
      const impact = await getDeleteImpact(note.id);

      setPendingDelete({
        note,
        impact,
      });
    } catch (error) {
      setActionError({
        sourceKey: activeSourceKey,
        message: getErrorMessage(error),
      });
    } finally {
      setIsPreparingDelete(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete || isMutating) {
      return;
    }

    clearError();
    setDeleteErrorMessage(null);

    try {
      await deleteNote(pendingDelete.note.id);

      if (editingNoteId === pendingDelete.note.id) {
        handleCancelEdit();
      }

      setPendingDelete(null);
    } catch (error) {
      setDeleteErrorMessage(getErrorMessage(error));
    }
  }

  async function handleViewSource(noteId: number) {
    setActionError(null);

    try {
      await openNoteContext(noteId);
    } catch (error) {
      setActionError({
        sourceKey: activeSourceKey,
        message: getErrorMessage(error),
      });
    }
  }

  function handleCreateTask(note: Note) {
    beginTaskFromNote(note);
    openRightPanel("tools");
  }

  function renderNote(note: Note, current: boolean) {
    return (
      <NoteCard
        key={note.id}
        note={note}
        current={current}
        variant={current ? "workspace-current" : "workspace-recent"}
        isMutating={isMutating || isPreparingDelete}
        isEditing={editingNoteId === note.id}
        editingContent={editingContent}
        onEditingContentChange={setEditingContent}
        onStartEdit={handleStartEdit}
        onCancelEdit={handleCancelEdit}
        onSaveEdit={handleSaveEdit}
        onDelete={handleDelete}
        onViewSource={handleViewSource}
        onCreateTask={handleCreateTask}
        onOpenDetail={(noteId) => navigate(`/notes/${noteId}`)}
      />
    );
  }

  return (
    <>
      <QuickNoteComposer
        hasActiveSource={activeSource !== null}
        sourceLabel={activeSource?.label}
        sourceTitle={activeSource?.title}
        supportsTimestamp={activeSource?.entityType !== "image"}
        requiresAvailableTimestamp={activeSource?.entityType === "audio"}
        timestamp={activeContext?.timestamp}
        content={captureContent}
        includeTimestamp={includeTimestamp}
        isMutating={isMutating}
        errorMessage={createErrorMessage}
        onContentChange={(value) => {
          setCaptureContent(value);
          setCreateError(null);
        }}
        onIncludeTimestampChange={setIncludeTimestamp}
        onCreate={handleCreate}
      />

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 px-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">
            Current {activeSource?.label ?? "source"}
          </h4>

          <span className="tabular-nums text-xs text-(--text-muted)">
            {currentSourceLoadStatus === "success"
              ? currentSourceNotes.length
              : "—"}
          </span>
        </div>

        {actionErrorMessage && (
          <p
            role="alert"
            className="mt-2 rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)"
          >
            {actionErrorMessage}
          </p>
        )}

        {currentSourceLoadStatus === "error" && (
          <p
            role="alert"
            className="mt-2 rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)"
          >
            {currentSourceLoadError?.message ??
              "Could not load notes for this source."}
          </p>
        )}

        {activeSource === null ? (
          <p className="mt-2 px-1 text-xs text-(--text-muted)">
            No active Library item.
          </p>
        ) : (currentSourceLoadStatus === "idle" ||
            currentSourceLoadStatus === "loading") &&
          currentSourceNotes.length === 0 ? (
          <p role="status" className="mt-2 px-1 text-xs text-(--text-muted)">
            Loading {activeSource.label} notes...
          </p>
        ) : currentSourceLoadStatus === "success" &&
          currentSourceNotes.length === 0 ? (
          <p className="mt-2 px-1 text-xs text-(--text-muted)">
            No notes for this {activeSource.label} yet.
          </p>
        ) : currentSourceNotes.length > 0 ? (
          <div className="mt-2 space-y-2">
            {currentSourceNotes.map((note) => renderNote(note, true))}
          </div>
        ) : null}
      </div>

      <details className="group mt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-1.5 py-1.5 text-xs font-medium text-(--text-muted) outline-none transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:ring-2 focus-visible:ring-(--focus)">
          <span>
            Recent notes · {notesLoadStatus === "success" ? totalElements : "—"}
          </span>

          <ChevronDown
            size={14}
            className="shrink-0 text-(--text-faint) transition-transform duration-150 group-open:rotate-180"
            aria-hidden="true"
          />
        </summary>

        {notesLoadStatus === "error" && (
          <p
            role="alert"
            className="mt-3 rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)"
          >
            {notesLoadError?.message ?? "Could not load recent notes."}
          </p>
        )}

        {notes.length > 0 ? (
          <div className="mt-3 space-y-2">
            {notes.map((note) => renderNote(note, false))}
          </div>
        ) : notesLoadStatus === "success" ? (
          <p role="status" className="mt-3 px-1 text-xs text-(--text-muted)">
            No notes yet.
          </p>
        ) : notesLoadStatus === "idle" || notesLoadStatus === "loading" ? (
          <p role="status" className="mt-3 px-1 text-xs text-(--text-muted)">
            Loading notes...
          </p>
        ) : null}
      </details>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete Note?"
        description={
          pendingDelete
            ? "This will delete the selected Note. Its exact source history is handled according to the impact below."
            : undefined
        }
        details={
          pendingDelete
            ? [
                `${pendingDelete.impact.taskCountToMarkSourceMissing} linked task(s) will lose their Note source.`,
                pendingDelete.impact.tasksPreserved
                  ? "Linked tasks will be preserved."
                  : "Linked tasks may be affected.",
                pendingDelete.impact.sourcePreserved
                  ? "The exact source will be preserved."
                  : "The exact source may be affected.",
              ]
            : []
        }
        confirmLabel="Delete Note"
        isBusy={isMutating}
        errorMessage={deleteErrorMessage}
        onConfirm={confirmDelete}
        onCancel={() => {
          setPendingDelete(null);
          setDeleteErrorMessage(null);
        }}
      />
    </>
  );
}
