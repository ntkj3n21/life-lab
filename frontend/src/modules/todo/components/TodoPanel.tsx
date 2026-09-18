import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../../../lib/api";
import {
  getWorkspaceSource,
  useContextStore,
} from "../../../stores/contextStore";
import { useNoteStore } from "../../../stores/noteStore";
import { useTodoStore } from "../../../stores/todoStore";
import { useWorkspaceStore } from "../../../stores/workspaceStore";
import {
  getTasks,
  type CreateTaskInput,
  type Task,
  type TaskStatus,
  type UpdateTaskInput,
} from "../services/taskApi";
import { TaskCard } from "./TaskCard";
import { TaskComposer } from "./TaskComposer";
import { TaskListPanel } from "./TaskListPanel";

const RECENT_TASK_LIMIT = 12;
const CURRENT_SOURCE_TASK_LIMIT = 20;

function getErrorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Something went wrong.";
}

export function TodoPanel() {
  const navigate = useNavigate();
  const activeContext = useContextStore((state) => state.activeContext);
  const isMutating = useTodoStore((state) => state.isMutating);
  const createIndependentTask = useTodoStore(
    (state) => state.createIndependentTask,
  );
  const createTaskFromNote = useTodoStore((state) => state.createTaskFromNote);
  const updateTask = useTodoStore((state) => state.updateTask);
  const changeStatus = useTodoStore((state) => state.changeStatus);
  const deleteTask = useTodoStore((state) => state.deleteTask);
  const clearError = useTodoStore((state) => state.clearError);
  const workspaceNotes = useNoteStore((state) => state.workspaceNotes);
  const workspaceNotesLoadStatus = useNoteStore(
    (state) => state.workspaceNotesLoadStatus,
  );
  const workspaceNotesLoadErrors = useNoteStore(
    (state) => state.workspaceNotesLoadErrors,
  );
  const loadWorkspaceNotes = useNoteStore((state) => state.loadWorkspaceNotes);
  const linkedNote = useWorkspaceStore((state) => state.pendingTaskSourceNote);
  const linkedNoteKind = useWorkspaceStore(
    (state) => state.pendingTaskSourceKind,
  );
  const selectLinkedNote = useWorkspaceStore(
    (state) => state.selectTaskSourceNote,
  );
  const clearLinkedNote = useWorkspaceStore(
    (state) => state.clearTaskSourceNote,
  );
  const clearPickerLinkedNote = useWorkspaceStore(
    (state) => state.clearPickerTaskSourceNote,
  );

  const activeSource = getWorkspaceSource(activeContext);
  const activeSourceKey = activeSource?.key ?? null;
  const activeSourceType = activeSource?.entityType ?? null;
  const activeSourceLibraryId = activeSource?.libraryId ?? null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentTotal, setRecentTotal] = useState(0);
  const [currentSourceTasks, setCurrentSourceTasks] = useState<Task[]>([]);
  const [currentSourceTotal, setCurrentSourceTotal] = useState(0);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [isLoadingCurrentSource, setIsLoadingCurrentSource] = useState(false);
  const [composerErrorMessage, setComposerErrorMessage] = useState<
    string | null
  >(null);
  const [recentLoadError, setRecentLoadError] = useState<string | null>(null);
  const [currentSourceLoadError, setCurrentSourceLoadError] = useState<
    string | null
  >(null);
  const [taskActionError, setTaskActionError] = useState<string | null>(null);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const recentRequestId = useRef(0);
  const currentSourceRequestId = useRef(0);
  const previousActiveSourceKey = useRef(activeSourceKey);

  const currentSourceNotes =
    activeSourceKey === null ? [] : (workspaceNotes[activeSourceKey] ?? []);

  const currentSourceNotesLoadStatus =
    activeSourceKey === null
      ? "idle"
      : (workspaceNotesLoadStatus[activeSourceKey] ?? "idle");

  const currentSourceNotesLoadError =
    activeSourceKey === null
      ? null
      : (workspaceNotesLoadErrors[activeSourceKey] ?? null);

  const loadRecentTasks = useCallback(async () => {
    const requestId = ++recentRequestId.current;
    try {
      const response = await getTasks({ page: 0, size: RECENT_TASK_LIMIT });
      if (requestId !== recentRequestId.current) return;
      setRecentTasks(response.items);
      setRecentTotal(response.totalElements);
      setRecentLoadError(null);
    } catch (error) {
      if (requestId !== recentRequestId.current) return;
      setRecentLoadError(getErrorMessage(error));
    } finally {
      if (requestId === recentRequestId.current) setIsLoadingRecent(false);
    }
  }, []);

  const loadCurrentSourceTasks = useCallback(async () => {
    const requestId = ++currentSourceRequestId.current;
    if (activeSourceType === null || activeSourceLibraryId === null) {
      setCurrentSourceTasks([]);
      setCurrentSourceTotal(0);
      setCurrentSourceLoadError(null);
      setIsLoadingCurrentSource(false);
      return;
    }

    try {
      const response = await getTasks({
        page: 0,
        size: CURRENT_SOURCE_TASK_LIMIT,
        ...(activeSourceType === "video"
          ? { libraryVideoId: activeSourceLibraryId }
          : activeSourceType === "image"
            ? { libraryImageId: activeSourceLibraryId }
            : { libraryAudioId: activeSourceLibraryId }),
      });
      if (requestId !== currentSourceRequestId.current) return;
      setCurrentSourceTasks(response.items);
      setCurrentSourceTotal(response.totalElements);
      setCurrentSourceLoadError(null);
    } catch (error) {
      if (requestId !== currentSourceRequestId.current) return;
      setCurrentSourceLoadError(getErrorMessage(error));
    } finally {
      if (requestId === currentSourceRequestId.current)
        setIsLoadingCurrentSource(false);
    }
  }, [activeSourceType, activeSourceLibraryId]);

  useEffect(() => {
    void Promise.resolve().then(loadRecentTasks);
  }, [loadRecentTasks]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setIsLoadingCurrentSource(true);
      return loadCurrentSourceTasks();
    });
  }, [loadCurrentSourceTasks]);

  useEffect(() => {
    if (previousActiveSourceKey.current === activeSourceKey) return;

    previousActiveSourceKey.current = activeSourceKey;

    clearPickerLinkedNote();
    setNotePickerOpen(false);
    setComposerErrorMessage(null);

    if (
      linkedNoteKind !== "explicit" ||
      linkedNote === null ||
      activeSourceKey === null ||
      activeSourceType === null ||
      activeSourceLibraryId === null
    ) {
      return;
    }

    let cancelled = false;
    const expectedSourceKey = activeSourceKey;
    const expectedNoteId = linkedNote.id;

    void loadWorkspaceNotes({
      entityType: activeSourceType,
      libraryId: activeSourceLibraryId,
    })
      .then((notes) => {
        if (cancelled) return;

        const currentSource = getWorkspaceSource(
          useContextStore.getState().activeContext,
        );
        const workspaceState = useWorkspaceStore.getState();

        if (
          currentSource?.key !== expectedSourceKey ||
          workspaceState.pendingTaskSourceKind !== "explicit" ||
          workspaceState.pendingTaskSourceNote?.id !== expectedNoteId
        ) {
          return;
        }

        if (!notes.some((note) => note.id === expectedNoteId)) {
          workspaceState.clearTaskSourceNote();
          setNotePickerOpen(false);
          setComposerErrorMessage(null);
        }
      })
      .catch(() => {
        // noteStore keeps the source load error.
        // Task submission revalidates before creating.
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeSourceKey,
    activeSourceLibraryId,
    activeSourceType,
    clearPickerLinkedNote,
    linkedNote,
    linkedNoteKind,
    loadWorkspaceNotes,
  ]);

  function buildTaskInput(): CreateTaskInput {
    return {
      title: title.trim(),
      description: description.trim() || null,
      deadline: deadline || null,
    };
  }

  function clearComposer() {
    setTitle("");
    setDescription("");
    setDeadline("");
    setComposerErrorMessage(null);
    setNotePickerOpen(false);
    clearLinkedNote();
  }

  async function refreshTaskSections() {
    setIsLoadingRecent(true);
    setIsLoadingCurrentSource(true);
    await Promise.all([loadRecentTasks(), loadCurrentSourceTasks()]);
  }

  async function handleCreate() {
    if (!title.trim() || isMutating) return;
    clearError();
    setComposerErrorMessage(null);

    try {
      if (linkedNote) {
        if (linkedNoteKind === "explicit" && activeSource !== null) {
          const expectedSourceKey = activeSource.key;
          const expectedNoteId = linkedNote.id;

          const sourceNotes = await loadWorkspaceNotes({
            entityType: activeSource.entityType,
            libraryId: activeSource.libraryId,
          });

          const currentSource = getWorkspaceSource(
            useContextStore.getState().activeContext,
          );
          const workspaceState = useWorkspaceStore.getState();

          if (
            currentSource?.key !== expectedSourceKey ||
            workspaceState.pendingTaskSourceKind !== "explicit" ||
            workspaceState.pendingTaskSourceNote?.id !== expectedNoteId
          ) {
            setComposerErrorMessage(
              "The active source changed. Review the linked Note and try again.",
            );
            return;
          }

          if (!sourceNotes.some((note) => note.id === expectedNoteId)) {
            workspaceState.clearTaskSourceNote();
            setComposerErrorMessage(
              "The selected Note does not belong to the active source.",
            );
            return;
          }
        }

        await createTaskFromNote(linkedNote.id, buildTaskInput());
      } else {
        await createIndependentTask(buildTaskInput());
      }
      clearComposer();
      await refreshTaskSections();
    } catch (error) {
      setComposerErrorMessage(getErrorMessage(error));
    }
  }

  function loadNotesForPicker() {
    if (activeSource === null) return;

    void loadWorkspaceNotes({
      entityType: activeSource.entityType,
      libraryId: activeSource.libraryId,
    }).catch(() => {
      // noteStore keeps the action-level load error for this source.
    });
  }

  function handleChooseNote() {
    if (activeSource === null) return;

    setNotePickerOpen(true);

    if (
      currentSourceNotesLoadStatus !== "success" &&
      currentSourceNotesLoadStatus !== "loading"
    ) {
      loadNotesForPicker();
    }
  }

  function handleSelectNote(note: (typeof currentSourceNotes)[number]) {
    if (activeSource === null) return;

    selectLinkedNote(note);
    setNotePickerOpen(false);
    setComposerErrorMessage(null);
  }

  function handleUnlinkNote() {
    clearLinkedNote();
    setNotePickerOpen(false);
    setComposerErrorMessage(null);
  }

  async function handleUpdate(taskId: number, input: UpdateTaskInput) {
    setTaskActionError(null);
    try {
      await updateTask(taskId, input);
      await refreshTaskSections();
    } catch (error) {
      setTaskActionError(getErrorMessage(error));
      throw error;
    }
  }

  async function handleStatusChange(taskId: number, status: TaskStatus) {
    setTaskActionError(null);
    try {
      await changeStatus(taskId, status);
      await refreshTaskSections();
    } catch (error) {
      setTaskActionError(getErrorMessage(error));
    }
  }

  async function handleDelete(taskId: number) {
    setTaskActionError(null);
    try {
      await deleteTask(taskId);
      await refreshTaskSections();
    } catch (error) {
      setTaskActionError(getErrorMessage(error));
      throw error;
    }
  }

  return (
    <div className="space-y-4">
      <TaskComposer
        title={title}
        description={description}
        deadline={deadline}
        linkedNote={linkedNote}
        showSourceControls
        canChooseNote={activeSource !== null}
        notePickerOpen={notePickerOpen}
        notes={currentSourceNotes}
        isLoadingNotes={currentSourceNotesLoadStatus === "loading"}
        noteLoadErrorMessage={
          currentSourceNotesLoadError
            ? getErrorMessage(currentSourceNotesLoadError)
            : null
        }
        sourceLabel={activeSource?.label}
        isMutating={isMutating}
        errorMessage={composerErrorMessage}
        onTitleChange={setTitle}
        onDescriptionChange={setDescription}
        onDeadlineChange={setDeadline}
        onChooseNote={handleChooseNote}
        onCloseNotePicker={() => setNotePickerOpen(false)}
        onRetryNotes={loadNotesForPicker}
        onSelectNote={handleSelectNote}
        onUnlinkNote={handleUnlinkNote}
        onCreate={handleCreate}
      />

      {taskActionError && (
        <p
          role="alert"
          className="rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)"
        >
          {taskActionError}
        </p>
      )}

      <section aria-busy={isLoadingCurrentSource}>
        <div className="flex items-center justify-between gap-3 px-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">
            Current {activeSource?.label ?? "source"}
          </h4>
          <span className="tabular-nums text-xs text-(--text-muted)">
            {isLoadingCurrentSource ? "—" : currentSourceTotal}
          </span>
        </div>

        {currentSourceLoadError && (
          <p
            role="alert"
            className="mt-2 rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)"
          >
            {currentSourceLoadError}
          </p>
        )}
        {activeSource === null ? (
          <p className="mt-2 px-1 text-xs text-(--text-muted)">
            No active Library item.
          </p>
        ) : isLoadingCurrentSource ? (
          <p role="status" className="mt-2 px-1 text-xs text-(--text-muted)">
            Loading {activeSource.label} tasks...
          </p>
        ) : currentSourceLoadError ? null : currentSourceTasks.length === 0 ? (
          <p className="mt-2 px-1 text-xs text-(--text-muted)">
            No linked tasks for this {activeSource.label} yet.
          </p>
        ) : (
          <div className="mt-2 space-y-2">
            {currentSourceTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                variant="workspace"
                isMutating={isMutating}
                onUpdate={handleUpdate}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onOpenDetail={(taskId) => navigate(`/tasks/${taskId}`)}
              />
            ))}
          </div>
        )}
      </section>

      <TaskListPanel
        tasks={recentTasks}
        totalElements={recentTotal}
        isLoading={isLoadingRecent}
        isMutating={isMutating}
        loadErrorMessage={recentLoadError}
        onUpdate={handleUpdate}
        onStatusChange={handleStatusChange}
        onDelete={handleDelete}
        onOpenDetail={(taskId) => navigate(`/tasks/${taskId}`)}
      />

      <button
        type="button"
        onClick={() => navigate("/tasks")}
        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-(--border) px-3 text-xs font-medium text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) xl:min-h-8"
      >
        View all Tasks
        <ExternalLink size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
