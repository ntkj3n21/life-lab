import {
  ListTodo,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { useNoteStore } from "../../../stores/noteStore";
import { useTodoStore } from "../../../stores/todoStore";

import type {
  CreateTaskInput,
  TaskStatus,
  UpdateTaskInput,
} from "../services/taskApi";

import { DailyPlanPanel } from "./DailyPlanPanel";
import { TaskComposer } from "./TaskComposer";
import {
  TaskListPanel,
  type StatusFilter,
} from "./TaskListPanel";

export function TodoPanel() {
  const tasks = useTodoStore(
    (state) => state.tasks,
  );

  const dailyPlan = useTodoStore(
    (state) => state.dailyPlan,
  );

  const totalElements = useTodoStore(
    (state) => state.totalElements,
  );

  const isLoading = useTodoStore(
    (state) => state.isLoading,
  );

  const isLoadingPlan = useTodoStore(
    (state) => state.isLoadingPlan,
  );

  const isMutating = useTodoStore(
    (state) => state.isMutating,
  );

  const error = useTodoStore(
    (state) => state.error,
  );

  const loadTasks = useTodoStore(
    (state) => state.loadTasks,
  );

  const loadDailyPlan = useTodoStore(
    (state) => state.loadDailyPlan,
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

  useEffect(() => {
    void Promise.all([
      loadTasks({
        page: 0,
        size: 100,
      }),

      loadDailyPlan(),

      loadNotes({
        page: 0,
        size: 100,
      }),
    ]).catch(() => {
      // Stores keep errors.
    });
  }, [
    loadTasks,
    loadDailyPlan,
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
    await Promise.all([
      loadTasks({
        page: 0,
        size: 100,
        q:
          searchText.trim() ||
          undefined,
        status:
          statusFilter ||
          undefined,
      }),

      loadDailyPlan(),
    ]);
  }

  async function handleCreate() {
    if (
      !title.trim() ||
      isMutating
    ) {
      return;
    }

    clearError();

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

      setTitle("");
      setDescription("");
      setDeadline("");
      setSourceNoteId("");

      await refresh();
    } catch {
      // Store keeps error.
    }
  }

  async function handleUpdate(
    taskId: number,
    input: UpdateTaskInput,
  ) {
    try {
      await updateTask(
        taskId,
        input,
      );

      await refresh();
    } catch {
      // Store keeps error.
    }
  }

  async function handleStatusChange(
    taskId: number,
    status: TaskStatus,
  ) {
    try {
      await changeStatus(
        taskId,
        status,
      );

      await refresh();
    } catch {
      // Store keeps error.
    }
  }

  async function handleDelete(
    taskId: number,
  ) {
    try {
      await deleteTask(
        taskId,
      );

      await refresh();
    } catch {
      // Store keeps error.
    }
  }

  async function applySearch() {
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
    } catch {
      // Store keeps error.
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
          error?.message ?? null
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

      <DailyPlanPanel
        dailyPlan={dailyPlan}
        isLoadingPlan={
          isLoadingPlan
        }
        isMutating={isMutating}
        onUpdate={handleUpdate}
        onStatusChange={
          handleStatusChange
        }
        onDelete={handleDelete}
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
      />

      <div className="flex items-center gap-2 px-1 text-[10px] text-neutral-700">
        <ListTodo size={11} />

        Tasks are stored in PostgreSQL. Daily Plan is
        derived and creates no separate task copies.
      </div>
    </div>
  );
}