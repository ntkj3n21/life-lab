import {
  CalendarDays,
  ChevronDown,
  ListTodo,
  Plus,
  Search,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { useNoteStore } from "../../../stores/noteStore";
import { useTodoStore } from "../../../stores/todoStore";

import type {
  CreateTaskInput,
  Task,
  TaskStatus,
  UpdateTaskInput,
} from "../services/taskApi";

import { TaskCard } from "./TaskCard";

type StatusFilter =
  | ""
  | TaskStatus;

interface PlanSectionProps {
  title: string;
  tasks: Task[];
  emptyText: string;

  isMutating: boolean;

  onUpdate: (
    taskId: number,
    input: UpdateTaskInput,
  ) => Promise<void>;

  onStatusChange: (
    taskId: number,
    status: TaskStatus,
  ) => Promise<void>;

  onDelete: (
    taskId: number,
  ) => Promise<void>;
}

function PlanSection({
  title,
  tasks,
  emptyText,
  isMutating,
  onUpdate,
  onStatusChange,
  onDelete,
}: PlanSectionProps) {
  return (
    <details
      open={
        tasks.length > 0
      }
      className="rounded-xl border border-neutral-800 bg-neutral-950 p-3"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">
          {title}
        </span>

        <div className="flex items-center gap-2">
          <span className="rounded-full bg-neutral-900 px-2 py-1 text-[10px] text-neutral-500">
            {tasks.length}
          </span>

          <ChevronDown
            size={13}
            className="text-neutral-600"
          />
        </div>
      </summary>

      {tasks.length === 0 ? (
        <p className="mt-3 text-xs text-neutral-600">
          {emptyText}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {tasks.map(
            (task) => (
              <TaskCard
                key={
                  task.id
                }
                task={
                  task
                }
                isMutating={
                  isMutating
                }
                onUpdate={
                  onUpdate
                }
                onStatusChange={
                  onStatusChange
                }
                onDelete={
                  onDelete
                }
              />
            ),
          )}
        </div>
      )}
    </details>
  );
}

export function TodoPanel() {
  const tasks =
    useTodoStore(
      (state) =>
        state.tasks,
    );

  const dailyPlan =
    useTodoStore(
      (state) =>
        state.dailyPlan,
    );

  const totalElements =
    useTodoStore(
      (state) =>
        state.totalElements,
    );

  const isLoading =
    useTodoStore(
      (state) =>
        state.isLoading,
    );

  const isLoadingPlan =
    useTodoStore(
      (state) =>
        state.isLoadingPlan,
    );

  const isMutating =
    useTodoStore(
      (state) =>
        state.isMutating,
    );

  const error =
    useTodoStore(
      (state) =>
        state.error,
    );

  const loadTasks =
    useTodoStore(
      (state) =>
        state.loadTasks,
    );

  const loadDailyPlan =
    useTodoStore(
      (state) =>
        state.loadDailyPlan,
    );

  const createIndependentTask =
    useTodoStore(
      (state) =>
        state.createIndependentTask,
    );

  const createTaskFromNote =
    useTodoStore(
      (state) =>
        state.createTaskFromNote,
    );

  const updateTask =
    useTodoStore(
      (state) =>
        state.updateTask,
    );

  const changeStatus =
    useTodoStore(
      (state) =>
        state.changeStatus,
    );

  const deleteTask =
    useTodoStore(
      (state) =>
        state.deleteTask,
    );

  const clearError =
    useTodoStore(
      (state) =>
        state.clearError,
    );

  const notes =
    useNoteStore(
      (state) =>
        state.notes,
    );

  const loadNotes =
    useNoteStore(
      (state) =>
        state.loadNotes,
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
  ] =
    useState<StatusFilter>(
      "",
    );

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
      title:
        title.trim(),

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
          Number(
            sourceNoteId,
          ),
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
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="flex items-center gap-2">
          <Plus
            size={16}
            className="text-neutral-500"
          />

          <div>
            <h4 className="text-sm font-medium text-neutral-300">
              Create Task
            </h4>

            <p className="mt-1 text-xs text-neutral-500">
              Create an independent
              task or link it to an
              existing Note.
            </p>
          </div>
        </div>

        <input
          value={title}
          maxLength={255}
          disabled={
            isMutating
          }
          onChange={(
            event,
          ) =>
            setTitle(
              event.target
                .value,
            )
          }
          placeholder="Task title"
          className="mt-3 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm outline-none placeholder:text-neutral-600"
        />

        <textarea
          value={description}
          disabled={
            isMutating
          }
          onChange={(
            event,
          ) =>
            setDescription(
              event.target
                .value,
            )
          }
          placeholder="Description (optional)"
          className="mt-2 h-20 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs outline-none placeholder:text-neutral-600"
        />

        <input
          type="date"
          value={deadline}
          disabled={
            isMutating
          }
          onChange={(
            event,
          ) =>
            setDeadline(
              event.target
                .value,
            )
          }
          className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none"
        />

        <select
          value={sourceNoteId}
          disabled={
            isMutating
          }
          onChange={(
            event,
          ) =>
            setSourceNoteId(
              event.target
                .value,
            )
          }
          className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 outline-none"
        >
          <option value="">
            Independent task
          </option>

          {notes.map(
            (note) => {
              const sourceTitle =
                note.youtubeSource
                  .title ??
                note.youtubeSource
                  .youtubeVideoId;

              const preview =
                note.content
                  .replace(
                    /\s+/g,
                    " ",
                  )
                  .slice(
                    0,
                    40,
                  );

              return (
                <option
                  key={
                    note.id
                  }
                  value={
                    note.id
                  }
                >
                  {sourceTitle}
                  {" — "}
                  {preview}
                </option>
              );
            },
          )}
        </select>

        <button
          type="button"
          disabled={
            isMutating ||
            !title.trim()
          }
          onClick={() =>
            void handleCreate()
          }
          className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isMutating
            ? "Saving..."
            : sourceNoteId
              ? "Create from Note"
              : "Create Task"}
        </button>

        {error && (
          <p className="mt-2 text-xs text-red-400">
            {error.message}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarDays
              size={16}
              className="text-neutral-500"
            />

            <div>
              <h4 className="text-sm font-medium text-neutral-300">
                Daily Plan
              </h4>

              <p className="mt-1 text-xs text-neutral-500">
                Derived from your
                current Tasks.
              </p>
            </div>
          </div>

          {dailyPlan && (
            <span className="rounded-full bg-neutral-900 px-2 py-1 text-[10px] text-neutral-500">
              {
                dailyPlan.currentDate
              }
            </span>
          )}
        </div>

        {isLoadingPlan &&
        !dailyPlan ? (
          <p className="mt-4 text-xs text-neutral-500">
            Loading plan...
          </p>
        ) : !dailyPlan ? (
          <p className="mt-4 text-xs text-neutral-600">
            Daily Plan unavailable.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            <PlanSection
              title="Overdue"
              tasks={
                dailyPlan.overdue
              }
              emptyText="No overdue tasks."
              isMutating={
                isMutating
              }
              onUpdate={
                handleUpdate
              }
              onStatusChange={
                handleStatusChange
              }
              onDelete={
                handleDelete
              }
            />

            <PlanSection
              title="Today"
              tasks={
                dailyPlan.today
              }
              emptyText="Nothing due today."
              isMutating={
                isMutating
              }
              onUpdate={
                handleUpdate
              }
              onStatusChange={
                handleStatusChange
              }
              onDelete={
                handleDelete
              }
            />

            <PlanSection
              title="Upcoming"
              tasks={
                dailyPlan.upcoming
              }
              emptyText="No upcoming tasks."
              isMutating={
                isMutating
              }
              onUpdate={
                handleUpdate
              }
              onStatusChange={
                handleStatusChange
              }
              onDelete={
                handleDelete
              }
            />

            <PlanSection
              title="No deadline"
              tasks={
                dailyPlan.noDeadline
              }
              emptyText="No tasks without a deadline."
              isMutating={
                isMutating
              }
              onUpdate={
                handleUpdate
              }
              onStatusChange={
                handleStatusChange
              }
              onDelete={
                handleDelete
              }
            />

            <PlanSection
              title="Completed"
              tasks={
                dailyPlan.completed
              }
              emptyText="No completed tasks."
              isMutating={
                isMutating
              }
              onUpdate={
                handleUpdate
              }
              onStatusChange={
                handleStatusChange
              }
              onDelete={
                handleDelete
              }
            />

            <p className="pt-1 text-[10px] text-neutral-700">
              Time zone:{" "}
              {dailyPlan.timeZone}
            </p>
          </div>
        )}
      </section>

      <details className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <summary className="cursor-pointer text-sm font-medium text-neutral-300">
          All Tasks (
          {totalElements})
        </summary>

        <div className="mt-3 flex gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3">
            <Search
              size={14}
              className="text-neutral-600"
            />

            <input
              value={
                searchText
              }
              onChange={(
                event,
              ) =>
                setSearchText(
                  event.target
                    .value,
                )
              }
              onKeyDown={(
                event,
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  void applySearch();
                }
              }}
              placeholder="Search..."
              className="min-w-0 flex-1 bg-transparent py-2 text-xs outline-none"
            />
          </div>
        </div>

        <select
          value={statusFilter}
          onChange={(
            event,
          ) =>
            setStatusFilter(
              event.target
                .value as StatusFilter,
            )
          }
          className="mt-2 w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300"
        >
          <option value="">
            All statuses
          </option>

          <option value="NOT_STARTED">
            Not started
          </option>

          <option value="IN_PROGRESS">
            In progress
          </option>

          <option value="COMPLETED">
            Completed
          </option>
        </select>

        <button
          type="button"
          disabled={
            isLoading
          }
          onClick={() =>
            void applySearch()
          }
          className="mt-2 w-full rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-white"
        >
          Apply
        </button>

        {isLoading ? (
          <p className="mt-3 text-xs text-neutral-500">
            Loading tasks...
          </p>
        ) : tasks.length ===
          0 ? (
          <p className="mt-3 text-xs text-neutral-600">
            No tasks found.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {tasks.map(
              (task) => (
                <TaskCard
                  key={
                    task.id
                  }
                  task={
                    task
                  }
                  isMutating={
                    isMutating
                  }
                  onUpdate={
                    handleUpdate
                  }
                  onStatusChange={
                    handleStatusChange
                  }
                  onDelete={
                    handleDelete
                  }
                />
              ),
            )}
          </div>
        )}
      </details>

      <div className="flex items-center gap-2 px-1 text-[10px] text-neutral-700">
        <ListTodo
          size={11}
        />

        Tasks are stored in
        PostgreSQL. Daily Plan is
        derived and creates no
        separate task copies.
      </div>
    </div>
  );
}