import { create } from "zustand";

import { ApiError } from "../lib/api";

import {
  resolveContextFromNote,
  resolveContextFromTask,
  type ContextResponse,
} from "../modules/context/services/contextApi";

interface ReverseContextStore {
  resolution: ContextResponse | null;

  isResolving: boolean;

  error: ApiError | null;

  resolveNote: (
    noteId: number,
  ) => Promise<ContextResponse>;

  resolveTask: (
    taskId: number,
  ) => Promise<ContextResponse>;

  clearResolution: () => void;

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
      "Could not resolve the original context.",
    fieldErrors: {},
  });
}

const initialState = {
  resolution:
    null as ContextResponse | null,

  isResolving: false,

  error: null as ApiError | null,
};

export const useReverseContextStore =
  create<ReverseContextStore>(
    (set) => ({
      ...initialState,

      resolveNote: async (
        noteId,
      ) => {
        set({
          isResolving: true,
          error: null,
        });

        try {
          const resolution =
            await resolveContextFromNote(
              noteId,
            );

          set({
            resolution,
          });

          return resolution;
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            error: apiError,
          });

          throw apiError;
        } finally {
          set({
            isResolving: false,
          });
        }
      },

      resolveTask: async (
        taskId,
      ) => {
        set({
          isResolving: true,
          error: null,
        });

        try {
          const resolution =
            await resolveContextFromTask(
              taskId,
            );

          set({
            resolution,
          });

          return resolution;
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            error: apiError,
          });

          throw apiError;
        } finally {
          set({
            isResolving: false,
          });
        }
      },

      clearResolution: () => {
        set({
          resolution: null,
        });
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