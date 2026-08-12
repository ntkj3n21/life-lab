import { useEffect, useRef } from "react";

import { useWatchStore } from "../../../stores/watchStore";

const WATCH_HEARTBEAT_INTERVAL_MS = 15_000;

interface UseVideoWatchTrackingOptions {
  activeLibraryVideoId?: number;
  onVideoTransition?: () => void;
}

export function useVideoWatchTracking({
  activeLibraryVideoId,
  onVideoTransition,
}: UseVideoWatchTrackingOptions) {
  const previousActiveVideoIdRef = useRef<number | null>(null);

  /*
   * Watch tracking uses real elapsed playing time,
   * not media currentTime.
   */
  const playbackStartedAtRef = useRef<number | null>(null);
  const pendingPlayedSecondsRef = useRef(0);
  const heartbeatTimerRef = useRef<number | null>(null);

  /*
   * Serializes start → heartbeat → close so requests
   * cannot race each other.
   */
  const watchOperationQueueRef = useRef<Promise<void>>(
    Promise.resolve(),
  );

  const onVideoTransitionRef = useRef(onVideoTransition);

  const watchSession = useWatchStore((state) => state.session);
  const watchError = useWatchStore((state) => state.error);
  const startWatch = useWatchStore((state) => state.start);
  const heartbeatWatch = useWatchStore((state) => state.heartbeat);
  const closeWatch = useWatchStore((state) => state.close);
  const resetWatch = useWatchStore((state) => state.reset);
  const clearWatchError = useWatchStore(
    (state) => state.clearError,
  );

  useEffect(() => {
    onVideoTransitionRef.current = onVideoTransition;
  }, [onVideoTransition]);

  useEffect(() => {
    const nextVideoId =
      typeof activeLibraryVideoId === "number" &&
      Number.isFinite(activeLibraryVideoId)
        ? activeLibraryVideoId
        : null;

    const previousVideoId = previousActiveVideoIdRef.current;

    if (previousVideoId === nextVideoId) {
      return;
    }

    previousActiveVideoIdRef.current = nextVideoId;

    if (previousVideoId === null) {
      return;
    }

    /*
     * Capture the final elapsed playback time that
     * belongs to the previous video before switching
     * context.
     */
    const startedAt = playbackStartedAtRef.current;

    if (startedAt !== null) {
      pendingPlayedSecondsRef.current += Math.max(
        0,
        (performance.now() - startedAt) / 1000,
      );
    }

    playbackStartedAtRef.current = null;

    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }

    const finalPlayedSeconds = Math.floor(
      pendingPlayedSecondsRef.current,
    );

    pendingPlayedSecondsRef.current = 0;
    onVideoTransitionRef.current?.();

    const closePreviousSession = async () => {
      const currentSession = useWatchStore.getState().session;

      if (
        !currentSession ||
        currentSession.endedAt !== null ||
        currentSession.libraryVideoId !== previousVideoId
      ) {
        return;
      }

      try {
        await closeWatch(finalPlayedSeconds);
      } catch {
        // watchStore keeps error.
      }
    };

    const nextOperation = watchOperationQueueRef.current.then(
      closePreviousSession,
      closePreviousSession,
    );

    watchOperationQueueRef.current = nextOperation.catch(() => {
      // watchStore keeps error.
    });
  }, [activeLibraryVideoId, closeWatch]);

  useEffect(() => {
    return () => {
      const startedAt = playbackStartedAtRef.current;

      if (startedAt !== null) {
        pendingPlayedSecondsRef.current += Math.max(
          0,
          (performance.now() - startedAt) / 1000,
        );
      }

      playbackStartedAtRef.current = null;

      if (heartbeatTimerRef.current !== null) {
        window.clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }

      const finalPlayedSeconds = Math.floor(
        pendingPlayedSecondsRef.current,
      );

      pendingPlayedSecondsRef.current = 0;

      const closeOnUnmount = async () => {
        const currentSession = useWatchStore.getState().session;

        if (!currentSession || currentSession.endedAt !== null) {
          return;
        }

        try {
          await useWatchStore
            .getState()
            .close(finalPlayedSeconds);
        } catch {
          // watchStore keeps error.
        }
      };

      const nextOperation = watchOperationQueueRef.current.then(
        closeOnUnmount,
        closeOnUnmount,
      );

      watchOperationQueueRef.current = nextOperation.catch(() => {
        // watchStore keeps error.
      });
    };
  }, []);

  function enqueueWatchOperation(
    operation: () => Promise<void>,
  ) {
    const nextOperation = watchOperationQueueRef.current.then(
      operation,
      operation,
    );

    watchOperationQueueRef.current = nextOperation.catch(() => {
      // Store already keeps the API error.
    });

    return nextOperation;
  }

  function captureElapsedPlayingTime() {
    const startedAt = playbackStartedAtRef.current;

    if (startedAt === null) {
      return;
    }

    const now = performance.now();
    const elapsedSeconds = Math.max(
      0,
      (now - startedAt) / 1000,
    );

    pendingPlayedSecondsRef.current += elapsedSeconds;

    /*
     * Continue measuring from now while playback is
     * still active.
     */
    playbackStartedAtRef.current = now;
  }

  function takeWholePendingSeconds() {
    const wholeSeconds = Math.floor(
      pendingPlayedSecondsRef.current,
    );

    pendingPlayedSecondsRef.current -= wholeSeconds;

    return wholeSeconds;
  }

  function startPlaybackClock() {
    if (playbackStartedAtRef.current === null) {
      playbackStartedAtRef.current = performance.now();
    }

    if (heartbeatTimerRef.current !== null) {
      return;
    }

    heartbeatTimerRef.current = window.setInterval(() => {
      void flushHeartbeat();
    }, WATCH_HEARTBEAT_INTERVAL_MS);
  }

  function stopPlaybackClock() {
    captureElapsedPlayingTime();
    playbackStartedAtRef.current = null;

    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
  }

  async function ensureWatchSession(libraryVideoId: number) {
    await enqueueWatchOperation(async () => {
      const currentSession = useWatchStore.getState().session;

      if (
        currentSession &&
        currentSession.endedAt === null &&
        currentSession.libraryVideoId === libraryVideoId
      ) {
        return;
      }

      /*
       * Safety fallback. Normally switching videos
       * already closes the previous session first.
       */
      if (
        currentSession &&
        currentSession.endedAt === null &&
        currentSession.libraryVideoId !== libraryVideoId
      ) {
        try {
          await closeWatch(0);
        } catch {
          return;
        }
      }

      try {
        await startWatch(libraryVideoId);
      } catch {
        // watchStore keeps the error.
      }
    });
  }

  async function flushHeartbeat() {
    captureElapsedPlayingTime();

    const playedSecondsDelta = takeWholePendingSeconds();

    if (playedSecondsDelta <= 0) {
      return;
    }

    await enqueueWatchOperation(async () => {
      const currentSession = useWatchStore.getState().session;

      if (!currentSession || currentSession.endedAt !== null) {
        /*
         * Session may still be starting. Keep these
         * seconds available for the next heartbeat.
         */
        pendingPlayedSecondsRef.current += playedSecondsDelta;
        return;
      }

      try {
        await heartbeatWatch(playedSecondsDelta);
      } catch {
        /*
         * Heartbeat failed. Keep the unsent time so a
         * later heartbeat can retry while this same
         * session is still active.
         */
        pendingPlayedSecondsRef.current += playedSecondsDelta;
      }
    });
  }

  async function finishWatchSession() {
    stopPlaybackClock();

    const finalPlayedSeconds = takeWholePendingSeconds();

    await enqueueWatchOperation(async () => {
      const currentSession = useWatchStore.getState().session;

      if (!currentSession || currentSession.endedAt !== null) {
        return;
      }

      try {
        await closeWatch(finalPlayedSeconds);
      } catch {
        /*
         * Do not reuse this delta for another video.
         * watchStore keeps the close error.
         */
      }
    });

    pendingPlayedSecondsRef.current = 0;
  }

  async function prepareForVideoSwitch(
    nextLibraryVideoId: number,
  ) {
    const currentSession = useWatchStore.getState().session;

    if (
      currentSession &&
      currentSession.libraryVideoId !== nextLibraryVideoId
    ) {
      await finishWatchSession();
    }
  }

  function startTracking(libraryVideoId: number) {
    startPlaybackClock();
    void ensureWatchSession(libraryVideoId);
  }

  function pauseTracking() {
    stopPlaybackClock();
    void flushHeartbeat();
  }

  function waitTracking() {
    stopPlaybackClock();
    void flushHeartbeat();
  }

  function endTracking() {
    void finishWatchSession();
  }

  function resetAfterVideoDelete() {
    /*
     * Backend delete removes the Library video's
     * WatchSessions, so there is nothing left to
     * close after deletion.
     */
    stopPlaybackClock();
    pendingPlayedSecondsRef.current = 0;
    resetWatch();
  }

  return {
    watchSession,
    watchError,
    clearWatchError,
    finishWatchSession,
    prepareForVideoSwitch,
    resetAfterVideoDelete,
    startTracking,
    pauseTracking,
    waitTracking,
    endTracking,
  };
}