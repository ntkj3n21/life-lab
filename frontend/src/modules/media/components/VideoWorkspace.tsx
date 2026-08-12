import { useEffect, useRef } from "react";
import {
  Clock,
  Film,
  Play,
  TriangleAlert,
  X,
} from "lucide-react";

import { ContextSummary } from "../../../components/context/ContextSummary";
import { useContextStore } from "../../../stores/contextStore";
import { useLibraryStore } from "../../../stores/libraryStore";
import { useWatchStore } from "../../../stores/watchStore";
import { formatTime } from "../../../utils/formatTime";
import {
  getLibraryVideoDisplayTitle,
  type LibraryVideo,
} from "../services/libraryApi";
import { BackendVideoLibrary } from "./BackendVideoLibrary";
import { EmbedVideoPlayer } from "./EmbedVideoPlayer";

const WATCH_HEARTBEAT_INTERVAL_MS = 15_000;

export function VideoWorkspace() {
  const playerRef = useRef<HTMLVideoElement | null>(null);

  const lastTrackedSecondRef = useRef<number | null>(
    null,
  );

  const skipNextSeekRef = useRef(false);
  const previousActiveVideoIdRef = useRef<number | null>(null);

  /*
   * Watch tracking uses real elapsed playing time,
   * not media currentTime.
   */
  const playbackStartedAtRef = useRef<number | null>(
    null,
  );

  const pendingPlayedSecondsRef = useRef(0);

  const heartbeatTimerRef = useRef<number | null>(
    null,
  );

  /*
   * Serializes start → heartbeat → close so requests
   * cannot race each other.
   */
  const watchOperationQueueRef = useRef<
    Promise<void>
  >(Promise.resolve());

  const activeContext = useContextStore(
    (state) => state.activeContext,
  );

  const setActiveContext = useContextStore(
    (state) => state.setActiveContext,
  );

  const clearActiveContext = useContextStore(
    (state) => state.clearActiveContext,
  );

  const setTimestamp = useContextStore(
    (state) => state.setTimestamp,
  );

  const increaseTimestamp = useContextStore(
    (state) => state.increaseTimestamp,
  );

  const decreaseTimestamp = useContextStore(
    (state) => state.decreaseTimestamp,
  );

  const videos = useLibraryStore(
    (state) => state.videos,
  );

  const watchSession = useWatchStore(
    (state) => state.session,
  );

  const watchError = useWatchStore(
    (state) => state.error,
  );

  const startWatch = useWatchStore(
    (state) => state.start,
  );

  const heartbeatWatch = useWatchStore(
    (state) => state.heartbeat,
  );

  const closeWatch = useWatchStore(
    (state) => state.close,
  );

  const resetWatch = useWatchStore(
    (state) => state.reset,
  );

  const clearWatchError = useWatchStore(
    (state) => state.clearError,
  );

  const activeVideo =
    activeContext?.entityType === "video"
      ? videos.find(
          (video) =>
            String(video.id) ===
            activeContext.entityId,
        )
      : undefined;

  const activeLibraryVideoId =
    activeContext?.entityType === "video"
      ? Number(activeContext.entityId)
      : undefined;

  const isVideoUnavailable =
    activeVideo?.youtubeSource.availabilityStatus ===
    "UNAVAILABLE";

  const canPlayVideo =
    Boolean(activeVideo) && !isVideoUnavailable;

  /*
   * Keep context title synchronized when the user
   * changes a Library video's custom title.
   */
  useEffect(() => {
    if (!activeVideo || !activeContext) {
      return;
    }

    if (activeContext.entityType !== "video") {
      return;
    }

    const displayTitle =
      getLibraryVideoDisplayTitle(activeVideo);

    if (activeContext.title === displayTitle) {
      return;
    }

    setActiveContext({
      ...activeContext,
      title: displayTitle,
    });
  }, [
    activeVideo,
    activeContext,
    setActiveContext,
  ]);


  useEffect(() => {
    const nextVideoId =
      typeof activeLibraryVideoId ===
        "number" &&
      Number.isFinite(
        activeLibraryVideoId,
      )
        ? activeLibraryVideoId
        : null;

    const previousVideoId =
      previousActiveVideoIdRef.current;

    if (
      previousVideoId ===
      nextVideoId
    ) {
      return;
    }

    previousActiveVideoIdRef.current =
      nextVideoId;

    if (
      previousVideoId === null
    ) {
      return;
    }

    /*
    * Capture the final elapsed playback
    * time that belongs to the previous
    * video before switching context.
    */
    const startedAt =
      playbackStartedAtRef.current;

    if (startedAt !== null) {
      pendingPlayedSecondsRef.current +=
        Math.max(
          0,
          (
            performance.now() -
            startedAt
          ) / 1000,
        );
    }

    playbackStartedAtRef.current =
      null;

    if (
      heartbeatTimerRef.current !==
      null
    ) {
      window.clearInterval(
        heartbeatTimerRef.current,
      );

      heartbeatTimerRef.current =
        null;
    }

    const finalPlayedSeconds =
      Math.floor(
        pendingPlayedSecondsRef.current,
      );

    pendingPlayedSecondsRef.current =
      0;

    lastTrackedSecondRef.current =
      null;

    skipNextSeekRef.current =
      false;

    const closePreviousSession =
      async () => {
        const currentSession =
          useWatchStore.getState()
            .session;

        if (
          !currentSession ||
          currentSession.endedAt !==
            null ||
          currentSession.libraryVideoId !==
            previousVideoId
        ) {
          return;
        }

        try {
          await closeWatch(
            finalPlayedSeconds,
          );
        } catch {
          // watchStore keeps error.
        }
      };

    const nextOperation =
      watchOperationQueueRef.current.then(
        closePreviousSession,
        closePreviousSession,
      );

    watchOperationQueueRef.current =
      nextOperation.catch(() => {
        // watchStore keeps error.
      });
  }, [
    activeLibraryVideoId,
    closeWatch,
  ]);
  /*
   * Seek player when context timestamp changes
   * manually or later through reverse context.
   */
  useEffect(() => {
    const player = playerRef.current;

    if (!player || !activeVideo || isVideoUnavailable) {
      return;
    }

    if (
      typeof activeContext?.timestamp !== "number"
    ) {
      return;
    }

    if (skipNextSeekRef.current) {
      skipNextSeekRef.current = false;
      return;
    }

    try {
      player.currentTime =
        activeContext.timestamp;
    } catch (error) {
      console.error(
        "Failed to seek video timestamp:",
        error,
      );
    }
  }, [
    activeContext?.entityId,
    activeContext?.timestamp,
    activeVideo,
    isVideoUnavailable,
  ]);

  /*
   * Clean local timers when the workspace unmounts.
   *
   * We intentionally do not fire an async close from
   * this cleanup because unload/logout requests are
   * handled separately later.
   */

  useEffect(() => {
    return () => {
      const startedAt =
        playbackStartedAtRef.current;

      if (startedAt !== null) {
        pendingPlayedSecondsRef.current +=
          Math.max(
            0,
            (
              performance.now() -
              startedAt
            ) / 1000,
          );
      }

      playbackStartedAtRef.current =
        null;

      if (
        heartbeatTimerRef.current !==
        null
      ) {
        window.clearInterval(
          heartbeatTimerRef.current,
        );

        heartbeatTimerRef.current =
          null;
      }

      const finalPlayedSeconds =
        Math.floor(
          pendingPlayedSecondsRef.current,
        );

      pendingPlayedSecondsRef.current =
        0;

      const closeOnUnmount =
        async () => {
          const currentSession =
            useWatchStore.getState()
              .session;

          if (
            !currentSession ||
            currentSession.endedAt !==
              null
          ) {
            return;
          }

          try {
            await useWatchStore
              .getState()
              .close(
                finalPlayedSeconds,
              );
          } catch {
            // watchStore keeps error.
          }
        };

      const nextOperation =
        watchOperationQueueRef.current.then(
          closeOnUnmount,
          closeOnUnmount,
        );

      watchOperationQueueRef.current =
        nextOperation.catch(() => {
          // watchStore keeps error.
        });
    };
  }, []);
  function enqueueWatchOperation(
    operation: () => Promise<void>,
  ) {
    const nextOperation =
      watchOperationQueueRef.current.then(
        operation,
        operation,
      );

    watchOperationQueueRef.current =
      nextOperation.catch(() => {
        // Store already keeps the API error.
      });

    return nextOperation;
  }

  function captureElapsedPlayingTime() {
    const startedAt =
      playbackStartedAtRef.current;

    if (startedAt === null) {
      return;
    }

    const now = performance.now();

    const elapsedSeconds = Math.max(
      0,
      (now - startedAt) / 1000,
    );

    pendingPlayedSecondsRef.current +=
      elapsedSeconds;

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

    pendingPlayedSecondsRef.current -=
      wholeSeconds;

    return wholeSeconds;
  }

  function startPlaybackClock() {
    if (
      playbackStartedAtRef.current === null
    ) {
      playbackStartedAtRef.current =
        performance.now();
    }

    if (heartbeatTimerRef.current !== null) {
      return;
    }

    heartbeatTimerRef.current =
      window.setInterval(() => {
        void flushHeartbeat();
      }, WATCH_HEARTBEAT_INTERVAL_MS);
  }

  function stopPlaybackClock() {
    captureElapsedPlayingTime();

    playbackStartedAtRef.current = null;

    if (heartbeatTimerRef.current !== null) {
      window.clearInterval(
        heartbeatTimerRef.current,
      );

      heartbeatTimerRef.current = null;
    }
  }

  async function ensureWatchSession(
    libraryVideoId: number,
  ) {
    await enqueueWatchOperation(async () => {
      const currentSession =
        useWatchStore.getState().session;

      if (
        currentSession &&
        currentSession.endedAt === null &&
        currentSession.libraryVideoId ===
          libraryVideoId
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
        currentSession.libraryVideoId !==
          libraryVideoId
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

    const playedSecondsDelta =
      takeWholePendingSeconds();

    if (playedSecondsDelta <= 0) {
      return;
    }

    await enqueueWatchOperation(async () => {
      const currentSession =
        useWatchStore.getState().session;

      if (
        !currentSession ||
        currentSession.endedAt !== null
      ) {
        /*
         * Session may still be starting. Keep these
         * seconds available for the next heartbeat.
         */
        pendingPlayedSecondsRef.current +=
          playedSecondsDelta;

        return;
      }

      try {
        await heartbeatWatch(
          playedSecondsDelta,
        );
      } catch {
        /*
         * Heartbeat failed. Keep the unsent time so a
         * later heartbeat can retry while this same
         * session is still active.
         */
        pendingPlayedSecondsRef.current +=
          playedSecondsDelta;
      }
    });
  }

  async function finishWatchSession() {
    stopPlaybackClock();

    const finalPlayedSeconds =
      takeWholePendingSeconds();

    await enqueueWatchOperation(async () => {
      const currentSession =
        useWatchStore.getState().session;

      if (
        !currentSession ||
        currentSession.endedAt !== null
      ) {
        return;
      }

      try {
        await closeWatch(
          finalPlayedSeconds,
        );
      } catch {
        /*
         * Do not reuse this delta for another video.
         * watchStore keeps the close error.
         */
      }
    });

    pendingPlayedSecondsRef.current = 0;
  }

  async function handleOpenVideo(
    video: LibraryVideo,
  ) {
    const currentSession =
      useWatchStore.getState().session;

    if (
      currentSession &&
      currentSession.libraryVideoId !== video.id
    ) {
      await finishWatchSession();
    }

    lastTrackedSecondRef.current = null;
    skipNextSeekRef.current = false;

    clearWatchError();

    setActiveContext({
      entityId: String(video.id),
      entityType: "video",
      title: getLibraryVideoDisplayTitle(video),
      timestamp: 0,
    });
  }

  async function handleCloseVideo() {
    await finishWatchSession();

    lastTrackedSecondRef.current = null;
    skipNextSeekRef.current = false;

    clearActiveContext();
  }

  function handleVideoDeleted(
    libraryVideoId: number,
  ) {
    if (
      activeContext?.entityType !== "video" ||
      activeContext.entityId !==
        String(libraryVideoId)
    ) {
      return;
    }

    /*
     * Backend delete removes the Library video's
     * WatchSessions, so there is nothing left to
     * close after deletion.
     */
    stopPlaybackClock();

    pendingPlayedSecondsRef.current = 0;

    resetWatch();
    clearActiveContext();
  }

  function handlePlayerPlaying() {
    if (!activeVideo || isVideoUnavailable) {
      return;
    }

    startPlaybackClock();

    void ensureWatchSession(activeVideo.id);
  }

  function handlePlayerPause() {
    stopPlaybackClock();

    void flushHeartbeat();
  }

  function handlePlayerWaiting() {
    stopPlaybackClock();

    void flushHeartbeat();
  }

  function handlePlayerEnded() {
    void finishWatchSession();
  }

  function handleTrackVideoTime(
    currentTime: number,
  ) {
    if (!activeVideo || isVideoUnavailable) {
      return;
    }

    const currentSecond =
      Math.floor(currentTime);

    if (
      lastTrackedSecondRef.current ===
      currentSecond
    ) {
      return;
    }

    lastTrackedSecondRef.current =
      currentSecond;

    skipNextSeekRef.current = true;

    setTimestamp(currentTime);
  }

  return (
    <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-7xl">
        {activeVideo ? (
          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h3 className="truncate text-xl font-semibold">
                  {getLibraryVideoDisplayTitle(
                    activeVideo,
                  )}
                </h3>

                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-500">
                  {activeVideo.youtubeSource
                    .channelName && (
                    <span>
                      {
                        activeVideo.youtubeSource
                          .channelName
                      }
                    </span>
                  )}

                  {activeVideo.youtubeSource
                    .channelName && (
                    <span>•</span>
                  )}

                  <span>
                    {
                      activeVideo.youtubeSource
                        .youtubeVideoId
                    }
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  void handleCloseVideo()
                }
                className="flex shrink-0 items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-white"
              >
                <X size={16} />
                Close video
              </button>
            </div>

            <div className="mx-auto max-w-5xl">
              {isVideoUnavailable ? (
                <div className="flex aspect-video items-center justify-center rounded-3xl border border-red-950/70 bg-neutral-950 px-6">
                  <div className="max-w-md text-center">
                    <TriangleAlert
                      size={42}
                      className="mx-auto text-red-400"
                    />

                    <h4 className="mt-4 text-lg font-semibold">
                      Video unavailable
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-neutral-500">
                      This exact YouTube source is no
                      longer available. Life Lab keeps
                      the source reference and related
                      context instead of replacing it
                      with another video.
                    </p>
                  </div>
                </div>
              ) : (
                <EmbedVideoPlayer
                  title={getLibraryVideoDisplayTitle(
                    activeVideo,
                  )}
                  url={
                    activeVideo.youtubeSource
                      .sourceUrl
                  }
                  playerRef={playerRef}
                  onTimeUpdate={
                    handleTrackVideoTime
                  }
                  onPlaying={
                    handlePlayerPlaying
                  }
                  onPause={
                    handlePlayerPause
                  }
                  onWaiting={
                    handlePlayerWaiting
                  }
                  onEnded={
                    handlePlayerEnded
                  }
                />
              )}
            </div>
          </div>
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-3xl border border-neutral-800 bg-neutral-900 shadow-2xl">
            <div className="text-center">
              <Film
                className="mx-auto mb-4 text-neutral-500"
                size={56}
              />

              <h3 className="text-xl font-semibold">
                Video Area
              </h3>

              <p className="mt-2 max-w-md text-sm text-neutral-400">
                Chọn một video trong Library để bắt
                đầu xem và ghi note theo context.
              </p>

              {videos.length > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    void handleOpenVideo(videos[0])
                  }
                  className="mx-auto mt-5 flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
                >
                  <Play size={16} />
                  Open first video
                </button>
              ) : (
                <p className="mt-5 text-sm text-neutral-500">
                  Chưa có video nào. Hãy thêm YouTube
                  video vào Library bên dưới.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-[1fr_1.4fr] gap-4">
          <ContextSummary />

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Clock
                    size={16}
                    className="text-neutral-400"
                  />

                  <h4 className="font-medium">
                    Capture time
                  </h4>
                </div>

                <p className="mt-2 text-xs text-neutral-500">
                  Auto-updates while the video plays.
                  Notes and tasks will use this
                  timestamp when saved.
                </p>
              </div>

              <span
                className={`rounded-full px-2 py-1 text-xs ${
                  canPlayVideo
                    ? "bg-neutral-800 text-neutral-300"
                    : activeVideo
                      ? "bg-red-950/60 text-red-400"
                      : "bg-neutral-950 text-neutral-600"
                }`}
              >
                {canPlayVideo
                  ? "Live"
                  : activeVideo
                    ? "Unavailable"
                    : "No video"}
              </span>
            </div>

            <p className="mt-4 text-3xl font-semibold tabular-nums">
              {formatTime(
                activeContext?.timestamp,
              )}
            </p>

            <div className="mt-3 rounded-xl bg-neutral-950 px-3 py-2">
              <p className="text-xs text-neutral-500">
                Watch session
              </p>

              {watchSession ? (
                <p className="mt-1 text-xs text-neutral-300">
                  {watchSession.watchTimeSeconds}s
                  {" · "}
                  {watchSession.validityStatus}
                </p>
              ) : (
                <p className="mt-1 text-xs text-neutral-600">
                  Starts when the video actually plays.
                </p>
              )}

              {watchError && (
                <p className="mt-2 text-xs text-red-400">
                  {watchError.message}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  decreaseTimestamp(5)
                }
                disabled={!canPlayVideo}
                className="rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                -5s
              </button>

              <button
                type="button"
                onClick={() =>
                  setTimestamp(0)
                }
                disabled={!canPlayVideo}
                className="rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Reset
              </button>

              <button
                type="button"
                onClick={() =>
                  increaseTimestamp(5)
                }
                disabled={!canPlayVideo}
                className="rounded-xl border border-neutral-800 px-3 py-2 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                +5s
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 w-full">
          <BackendVideoLibrary
            activeVideoId={
              Number.isFinite(
                activeLibraryVideoId,
              )
                ? activeLibraryVideoId
                : undefined
            }
            onOpenVideo={(video) =>
              void handleOpenVideo(video)
            }
            onVideoDeleted={
              handleVideoDeleted
            }
          />
        </div>
      </div>
    </div>
  );
}