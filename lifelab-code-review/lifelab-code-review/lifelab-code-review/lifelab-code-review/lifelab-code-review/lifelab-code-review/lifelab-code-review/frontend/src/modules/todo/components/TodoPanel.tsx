import { ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../../../lib/api";
import { useContextStore } from "../../../stores/contextStore";
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
const CURRENT_VIDEO_TASK_LIMIT = 20;

function getErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Something went wrong.";
}

export function TodoPanel() {
  const navigate = useNavigate();
  const activeContext = useContextStore((state) => state.activeContext);
  const isMutating = useTodoStore((state) => state.isMutating);
  const createIndependentTask = useTodoStore((state) => state.createIndependentTask);
  const createTaskFromNote = useTodoStore((state) => state.createTaskFromNote);
  const updateTask = useTodoStore((state) => state.updateTask);
  const changeStatus = useTodoStore((state) => state.changeStatus);
  const deleteTask = useTodoStore((state) => state.deleteTask);
  const clearError = useTodoStore((state) => state.clearError);
  const videoNotes = useNoteStore((state) => state.videoNotes);
  const videoNotesLoadStatus = useNoteStore((state) => state.videoNotesLoadStatus);
  const videoNotesLoadErrors = useNoteStore((state) => state.videoNotesLoadErrors);
  const loadVideoNotes = useNoteStore((state) => state.loadVideoNotes);
  const linkedNote = useWorkspaceStore((state) => state.pendingTaskSourceNote);
  const selectLinkedNote = useWorkspaceStore((state) => state.beginTaskFromNote);
  const clearLinkedNote = useWorkspaceStore((state) => state.clearTaskSourceNote);

  const activeLibraryVideoId =
    activeContext?.entityType === "video" &&
    Number.isFinite(Number(activeContext.entityId))
      ? Number(activeContext.entityId)
      : null;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [recentTotal, setRecentTotal] = useState(0);
  const [currentVideoTasks, setCurrentVideoTasks] = useState<Task[]>([]);
  const [currentVideoTotal, setCurrentVideoTotal] = useState(0);
  const [isLoadingRecent, setIsLoadingRecent] = useState(true);
  const [isLoadingCurrentVideo, setIsLoadingCurrentVideo] = useState(false);
  const [composerErrorMessage, setComposerErrorMessage] = useState<string | null>(null);
  const [recentLoadError, setRecentLoadError] = useState<string | null>(null);
  const [currentVideoLoadError, setCurrentVideoLoadError] = useState<string | null>(null);
  const [taskActionError, setTaskActionError] = useState<string | null>(null);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const recentRequestId = useRef(0);
  const currentVideoRequestId = useRef(0);
  const previousActiveVideoId = useRef(activeLibraryVideoId);
  const linkedNoteVideoId = useRef(linkedNote ? activeLibraryVideoId : null);

  const currentVideoNotes =
    activeLibraryVideoId === null
      ? []
      : videoNotes[activeLibraryVideoId] ?? [];

  const currentVideoNotesLoadStatus =
    activeLibraryVideoId === null
      ? "idle"
      : videoNotesLoadStatus[activeLibraryVideoId] ?? "idle";

  const currentVideoNotesLoadError =
    activeLibraryVideoId === null
      ? null
      : videoNotesLoadErrors[activeLibraryVideoId] ?? null;

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

  const loadCurrentVideoTasks = useCallback(async () => {
    const requestId = ++currentVideoRequestId.current;
    if (activeLibraryVideoId === null) {
      setCurrentVideoTasks([]);
      setCurrentVideoTotal(0);
      setCurrentVideoLoadError(null);
      setIsLoadingCurrentVideo(false);
      return;
    }

    try {
      const response = await getTasks({
        page: 0,
        size: CURRENT_VIDEO_TASK_LIMIT,
        libraryVideoId: activeLibraryVideoId,
      });
      if (requestId !== currentVideoRequestId.current) return;
      setCurrentVideoTasks(response.items);
      setCurrentVideoTotal(response.totalElements);
      setCurrentVideoLoadError(null);
    } catch (error) {
      if (requestId !== currentVideoRequestId.current) return;
      setCurrentVideoLoadError(getErrorMessage(error));
    } finally {
      if (requestId === currentVideoRequestId.current) setIsLoadingCurrentVideo(false);
    }
  }, [activeLibraryVideoId]);

  useEffect(() => {
    void Promise.resolve().then(
      loadRecentTasks,
    );
  }, [loadRecentTasks]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      setIsLoadingCurrentVideo(true);
      return loadCurrentVideoTasks();
    });
  }, [loadCurrentVideoTasks]);

  useEffect(() => {
    if (previousActiveVideoId.current === activeLibraryVideoId) return;

    previousActiveVideoId.current = activeLibraryVideoId;
    linkedNoteVideoId.current = null;

    void Promise.resolve().then(() => {
      clearLinkedNote();
      setNotePickerOpen(false);
      setComposerErrorMessage(null);
    });
  }, [activeLibraryVideoId, clearLinkedNote]);

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
    linkedNoteVideoId.current = null;
    clearLinkedNote();
  }

  async function refreshTaskSections() {
    setIsLoadingRecent(true);
    setIsLoadingCurrentVideo(true);
    await Promise.all([loadRecentTasks(), loadCurrentVideoTasks()]);
  }

  async function handleCreate() {
    if (!title.trim() || isMutating) return;
    clearError();
    setComposerErrorMessage(null);

    if (
      linkedNote &&
      linkedNoteVideoId.current !== activeLibraryVideoId
    ) {
      linkedNoteVideoId.current = null;
      clearLinkedNote();
      setNotePickerOpen(false);
      setComposerErrorMessage(
        "Choose a source note from the current video.",
      );
      return;
    }

    try {
      if (linkedNote) {
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
    if (activeLibraryVideoId === null) return;

    void loadVideoNotes(activeLibraryVideoId).catch(() => {
      // noteStore keeps the action-level load error for this video.
    });
  }

  function handleChooseNote() {
    if (activeLibraryVideoId === null) return;

    setNotePickerOpen(true);

    if (
      currentVideoNotesLoadStatus !== "success" &&
      currentVideoNotesLoadStatus !== "loading"
    ) {
      loadNotesForPicker();
    }
  }

  function handleSelectNote(note: (typeof currentVideoNotes)[number]) {
    if (activeLibraryVideoId === null) return;

    linkedNoteVideoId.current = activeLibraryVideoId;
    selectLinkedNote(note);
    setNotePickerOpen(false);
    setComposerErrorMessage(null);
  }

  function handleUnlinkNote() {
    linkedNoteVideoId.current = null;
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
        canChooseNote={activeLibraryVideoId !== null}
        notePickerOpen={notePickerOpen}
        notes={currentVideoNotes}
        isLoadingNotes={currentVideoNotesLoadStatus === "loading"}
        noteLoadErrorMessage={
          currentVideoNotesLoadError
            ? getErrorMessage(currentVideoNotesLoadError)
            : null
        }
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
        <p role="alert" className="rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)">
          {taskActionError}
        </p>
      )}

      <section aria-busy={isLoadingCurrentVideo}>
        <div className="flex items-center justify-between gap-3 px-1">
          <h4 className="text-xs font-medium uppercase tracking-wide text-(--text-muted)">Current video</h4>
          <span className="tabular-nums text-xs text-(--text-muted)">
            {isLoadingCurrentVideo ? "—" : currentVideoTotal}
          </span>
        </div>

        {currentVideoLoadError && (
          <p role="alert" className="mt-2 rounded-lg border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)">
            {currentVideoLoadError}
          </p>
        )}
        {activeLibraryVideoId === null ? (
          <p className="mt-2 px-1 text-xs text-(--text-muted)">No active video.</p>
        ) : isLoadingCurrentVideo ? (
          <p role="status" className="mt-2 px-1 text-xs text-(--text-muted)">Loading video tasks...</p>
        ) : currentVideoLoadError ? null : currentVideoTasks.length === 0 ? (
          <p className="mt-2 px-1 text-xs text-(--text-muted)">No linked tasks for this video yet.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {currentVideoTasks.map((task) => (
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
