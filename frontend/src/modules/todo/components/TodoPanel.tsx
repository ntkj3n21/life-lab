import {
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../../../lib/api";
import { useNoteStore } from "../../../stores/noteStore";
import { useTodoStore } from "../../../stores/todoStore";

import type {
  CreateTaskInput,
  TaskStatus,
  UpdateTaskInput,
} from "../services/taskApi";

import { TaskComposer } from "./TaskComposer";
import {
  TaskListPanel,
  type StatusFilter,
} from "./TaskListPanel";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong.";
}

export function TodoPanel() {
  const navigate = useNavigate();

  const tasks = useTodoStore(
    (state) => state.tasks,
  );

  const totalElements = useTodoStore(
    (state) => state.totalElements,
  );

  const isLoading = useTodoStore(
    (state) => state.isLoading,
  );

  const isMutating = useTodoStore(
    (state) => state.isMutating,
  );

  const loadTasks = useTodoStore(
    (state) => state.loadTasks,
  );

  const createIndependentTask = useTodoStore(
    (state) => state.createIndependentTask,
  );

  const createTaskFromNote = useTodoStore(
    (state) => state.createTaskFromNote,
  );

  const updateTask = useTodoStore(
    (state) => state.updateTask,
  );

  const changeStatus = useTodoStore(
    (state) => state.changeStatus,
  );

  const deleteTask = useTodoStore(
    (state) => state.deleteTask,
  );

  const clearError = useTodoStore(
    (state) => state.clearError,
  );

  const notes = useNoteStore(
    (state) => state.notes,
  );

  const loadNotes = useNoteStore(
    (state) => state.loadNotes,
  );

  const [title, setTitle] =
    useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    deadline,
    setDeadline,
  ] = useState("");

  const [
    sourceNoteId,
    setSourceNoteId,
  ] = useState("");

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState<StatusFilter>("");

  const [
    composerErrorMessage,
    setComposerErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    taskListLoadErrorMessage,
    setTaskListLoadErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    taskActionErrorMessage,
    setTaskActionErrorMessage,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    void loadTasks({
      page: 0,
      size: 100,
    })
      .then(() => {
        setTaskListLoadErrorMessage(null);
      })
      .catch((error: unknown) => {
        setTaskListLoadErrorMessage(
          getErrorMessage(error),
        );
      });

    void loadNotes({
        page: 0,
        size: 100,
      })
      .then(() => {
        setComposerErrorMessage(null);
      })
      .catch((error: unknown) => {
        setComposerErrorMessage(
          getErrorMessage(error),
        );
      });
  }, [
    loadTasks,
    loadNotes,
  ]);

  function buildTaskInput():
    CreateTaskInput {
    return {
      title: title.trim(),
      description:
        description.trim() ||
        null,
      deadline:
        deadline || null,
    };
  }

  async function refresh() {
    try {
      await loadTasks({
        page: 0,
        size: 100,
        q:
          searchText.trim() ||
          undefined,
        status:
          statusFilter ||
          undefined,
      });

      setTaskListLoadErrorMessage(null);
      return true;
    } catch (error) {
      setTaskListLoadErrorMessage(
        getErrorMessage(error),
      );
      return false;
    }
  }

  async function handleCreate() {
    if (
      !title.trim() ||
      isMutating
    ) {
      return;
    }

    clearError();
    setComposerErrorMessage(null);

    const input =
      buildTaskInput();

    try {
      if (sourceNoteId) {
        await createTaskFromNote(
          Number(sourceNoteId),
          input,
        );
      } else {
        await createIndependentTask(
          input,
        );
      }

    } catch (error) {
      setComposerErrorMessage(
        getErrorMessage(error),
      );
      return;
    }

    setTitle("");
    setDescription("");
    setDeadline("");
    setSourceNoteId("");

    await refresh();
  }

  async function handleUpdate(
    taskId: number,
    input: UpdateTaskInput,
  ) {
    setTaskActionErrorMessage(null);

    try {
      await updateTask(
        taskId,
        input,
      );
    } catch (error) {
      setTaskActionErrorMessage(
        getErrorMessage(error),
      );
      throw error;
    }

    await refresh();
  }

  async function handleStatusChange(
    taskId: number,
    status: TaskStatus,
  ) {
    setTaskActionErrorMessage(null);

    try {
      await changeStatus(
        taskId,
        status,
      );
    } catch (error) {
      setTaskActionErrorMessage(
        getErrorMessage(error),
      );
      return;
    }

    await refresh();
  }

  async function handleDelete(
    taskId: number,
  ) {
    setTaskActionErrorMessage(null);

    try {
      await deleteTask(
        taskId,
      );
    } catch (error) {
      setTaskActionErrorMessage(
        getErrorMessage(error),
      );
      throw error;
    }

    await refresh();
  }

  async function applySearch() {
    setTaskActionErrorMessage(null);

    try {
      await loadTasks({
        page: 0,
        size: 100,
        q:
          searchText.trim() ||
          undefined,
        status:
          statusFilter ||
          undefined,
      });

      setTaskListLoadErrorMessage(null);
    } catch (error) {
      setTaskListLoadErrorMessage(
        getErrorMessage(error),
      );
    }
  }

  return (
    <div className="space-y-4">
      <TaskComposer
        notes={notes}
        title={title}
        description={description}
        deadline={deadline}
        sourceNoteId={sourceNoteId}
        isMutating={isMutating}
        errorMessage={
          composerErrorMessage
        }
        onTitleChange={setTitle}
        onDescriptionChange={
          setDescription
        }
        onDeadlineChange={
          setDeadline
        }
        onSourceNoteIdChange={
          setSourceNoteId
        }
        onCreate={handleCreate}
      />

      <TaskListPanel
        tasks={tasks}
        totalElements={
          totalElements
        }
        searchText={searchText}
        statusFilter={
          statusFilter
        }
        isLoading={isLoading}
        isMutating={isMutating}
        loadErrorMessage={
          taskListLoadErrorMessage
        }
        actionErrorMessage={
          taskActionErrorMessage
        }
        onSearchTextChange={
          setSearchText
        }
        onStatusFilterChange={
          setStatusFilter
        }
        onApplySearch={applySearch}
        onUpdate={handleUpdate}
        onStatusChange={
          handleStatusChange
        }
        onDelete={handleDelete}
        onOpenDetail={(taskId) =>
          navigate(
            `/tasks/${taskId}`,
          )
        }
      />
    </div>
  );
}
