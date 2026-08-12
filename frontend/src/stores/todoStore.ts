import { create } from "zustand";

import { ApiError } from "../lib/api";

import {
  createIndependentTask as createIndependentTaskRequest,
  createTaskFromNote as createTaskFromNoteRequest,
  deleteTask as deleteTaskRequest,
  getDailyPlan as getDailyPlanRequest,
  getTasks,
  updateTask as updateTaskRequest,
  updateTaskStatus as updateTaskStatusRequest,
  type CreateTaskInput,
  type DailyPlan,
  type Task,
  type TaskQuery,
  type TaskStatus,
  type UpdateTaskInput,
} from "../modules/todo/services/taskApi";

interface TodoStore {
  tasks: Task[];

  page: number;
  size: number;
  totalElements: number;
  totalPages: number;

  dailyPlan: DailyPlan | null;

  isLoading: boolean;
  isLoadingPlan: boolean;
  isMutating: boolean;

  error: ApiError | null;

  loadTasks: (
    query?: TaskQuery,
  ) => Promise<void>;

  loadDailyPlan:
    () => Promise<DailyPlan>;

  createIndependentTask: (
    input: CreateTaskInput,
  ) => Promise<Task>;

  createTaskFromNote: (
    noteId: number,
    input: CreateTaskInput,
  ) => Promise<Task>;

  updateTask: (
    taskId: number,
    input: UpdateTaskInput,
  ) => Promise<Task>;

  changeStatus: (
    taskId: number,
    status: TaskStatus,
  ) => Promise<Task>;

  deleteTask: (
    taskId: number,
  ) => Promise<void>;

  clearError: () => void;
  reset: () => void;
}

function toApiError(
  error: unknown,
) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(0, {
    code: "UNKNOWN_ERROR",
    message:
      "Something went wrong.",
    fieldErrors: {},
  });
}

const initialState = {
  tasks: [] as Task[],

  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,

  dailyPlan:
    null as DailyPlan | null,

  isLoading: false,
  isLoadingPlan: false,
  isMutating: false,

  error: null as ApiError | null,
};

function replaceTask(
  tasks: Task[],
  updatedTask: Task,
) {
  return tasks.map((task) =>
    task.id === updatedTask.id
      ? updatedTask
      : task,
  );
}

export const useTodoStore =
  create<TodoStore>(
    (set) => ({
      ...initialState,

      loadTasks: async (
        query = {},
      ) => {
        set({
          isLoading: true,
          error: null,
        });

        try {
          const response =
            await getTasks({
              page: 0,
              size: 100,
              ...query,
            });

          set({
            tasks:
              response.items,

            page:
              response.page,

            size:
              response.size,

            totalElements:
              response.totalElements,

            totalPages:
              response.totalPages,
          });
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            error: apiError,
          });

          throw apiError;
        } finally {
          set({
            isLoading: false,
          });
        }
      },

      loadDailyPlan:
        async () => {
          set({
            isLoadingPlan:
              true,
            error: null,
          });

          try {
            const dailyPlan =
              await getDailyPlanRequest();

            set({
              dailyPlan,
            });

            return dailyPlan;
          } catch (error) {
            const apiError =
              toApiError(error);

            set({
              error: apiError,
            });

            throw apiError;
          } finally {
            set({
              isLoadingPlan:
                false,
            });
          }
        },

      createIndependentTask:
        async (input) => {
          set({
            isMutating: true,
            error: null,
          });

          try {
            const task =
              await createIndependentTaskRequest(
                input,
              );

            set((state) => ({
              tasks: [
                task,
                ...state.tasks.filter(
                  (existing) =>
                    existing.id !==
                    task.id,
                ),
              ],

              totalElements:
                state.totalElements +
                1,
            }));

            return task;
          } catch (error) {
            const apiError =
              toApiError(error);

            set({
              error: apiError,
            });

            throw apiError;
          } finally {
            set({
              isMutating: false,
            });
          }
        },

      createTaskFromNote:
        async (
          noteId,
          input,
        ) => {
          set({
            isMutating: true,
            error: null,
          });

          try {
            const task =
              await createTaskFromNoteRequest(
                noteId,
                input,
              );

            set((state) => ({
              tasks: [
                task,
                ...state.tasks.filter(
                  (existing) =>
                    existing.id !==
                    task.id,
                ),
              ],

              totalElements:
                state.totalElements +
                1,
            }));

            return task;
          } catch (error) {
            const apiError =
              toApiError(error);

            set({
              error: apiError,
            });

            throw apiError;
          } finally {
            set({
              isMutating: false,
            });
          }
        },

      updateTask: async (
        taskId,
        input,
      ) => {
        set({
          isMutating: true,
          error: null,
        });

        try {
          const task =
            await updateTaskRequest(
              taskId,
              input,
            );

          set((state) => ({
            tasks:
              replaceTask(
                state.tasks,
                task,
              ),
          }));

          return task;
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            error: apiError,
          });

          throw apiError;
        } finally {
          set({
            isMutating: false,
          });
        }
      },

      changeStatus: async (
        taskId,
        status,
      ) => {
        set({
          isMutating: true,
          error: null,
        });

        try {
          const task =
            await updateTaskStatusRequest(
              taskId,
              status,
            );

          set((state) => ({
            tasks:
              replaceTask(
                state.tasks,
                task,
              ),
          }));

          return task;
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            error: apiError,
          });

          throw apiError;
        } finally {
          set({
            isMutating: false,
          });
        }
      },

      deleteTask: async (
        taskId,
      ) => {
        set({
          isMutating: true,
          error: null,
        });

        try {
          await deleteTaskRequest(
            taskId,
          );

          set((state) => ({
            tasks:
              state.tasks.filter(
                (task) =>
                  task.id !==
                  taskId,
              ),

            totalElements:
              Math.max(
                0,
                state.totalElements -
                  1,
              ),
          }));
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            error: apiError,
          });

          throw apiError;
        } finally {
          set({
            isMutating: false,
          });
        }
      },

      clearError: () => {
        set({
          error: null,
        });
      },

      reset: () => {
        set({
          ...initialState,
        });
      },
    }),
  );