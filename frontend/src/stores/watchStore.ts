import { create } from "zustand";

import { ApiError } from "../lib/api";
import {
  closeWatchSession,
  sendWatchHeartbeat,
  startWatchSession,
  type WatchSession,
} from "../modules/media/services/watchApi";

interface WatchStore {
  session: WatchSession | null;

  isStarting: boolean;
  isSyncing: boolean;

  error: ApiError | null;

  start: (
    libraryVideoId: number,
  ) => Promise<WatchSession>;

  heartbeat: (
    playedSecondsDelta: number,
  ) => Promise<WatchSession | null>;

  close: (
    playedSecondsDelta: number,
  ) => Promise<WatchSession | null>;

  clearError: () => void;
  reset: () => void;
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(0, {
    code: "UNKNOWN_ERROR",
    message: "Something went wrong.",
    fieldErrors: {},
  });
}

function normalizePlayedSecondsDelta(
  value: number,
) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

export const useWatchStore = create<WatchStore>(
  (set, get) => ({
    session: null,

    isStarting: false,
    isSyncing: false,

    error: null,

    start: async (libraryVideoId) => {
      const currentSession = get().session;

      if (
        currentSession &&
        currentSession.endedAt === null &&
        currentSession.libraryVideoId ===
          libraryVideoId
      ) {
        return currentSession;
      }

      set({
        isStarting: true,
        error: null,
      });

      try {
        const session =
          await startWatchSession(
            libraryVideoId,
          );

        set({
          session,
        });

        return session;
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      } finally {
        set({
          isStarting: false,
        });
      }
    },

    heartbeat: async (
      playedSecondsDelta,
    ) => {
      const session = get().session;

      if (!session || session.endedAt !== null) {
        return null;
      }

      const normalizedDelta =
        normalizePlayedSecondsDelta(
          playedSecondsDelta,
        );

      set({
        isSyncing: true,
        error: null,
      });

      try {
        const updatedSession =
          await sendWatchHeartbeat(
            session.id,
            normalizedDelta,
          );

        /*
         * Do not overwrite a newer session if the
         * active video changed while this request
         * was in flight.
         */
        if (
          get().session?.id === session.id
        ) {
          set({
            session: updatedSession,
          });
        }

        return updatedSession;
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      } finally {
        set({
          isSyncing: false,
        });
      }
    },

    close: async (
      playedSecondsDelta,
    ) => {
      const session = get().session;

      if (!session || session.endedAt !== null) {
        set({
          session: null,
        });

        return null;
      }

      const normalizedDelta =
        normalizePlayedSecondsDelta(
          playedSecondsDelta,
        );

      set({
        isSyncing: true,
        error: null,
      });

      try {
        const closedSession =
          await closeWatchSession(
            session.id,
            normalizedDelta,
          );

        if (
          get().session?.id === session.id
        ) {
          set({
            session: null,
          });
        }

        return closedSession;
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      } finally {
        set({
          isSyncing: false,
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
        session: null,
        isStarting: false,
        isSyncing: false,
        error: null,
      });
    },
  }),
);