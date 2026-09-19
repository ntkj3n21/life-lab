import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
} from "react-router-dom";

import { ContextSummary } from "../../../components/context/ContextSummary";
import type { AppShellOutletContext } from "../../../components/layout/AppShell";
import { useContextStore } from "../../../stores/contextStore";
import { useLibraryStore } from "../../../stores/libraryStore";
import { useLayoutStore } from "../../../stores/layoutStore";
import { useVideoWatchTracking } from "../hooks/useVideoWatchTracking";
import {
  getLibraryVideoNeighbors,
  getLibraryVideoDisplayTitle,
  type LibraryNavigationQuery,
  type LibraryVideo,
  type LibraryVideoNeighbors,
} from "../services/libraryApi";
import { BackendVideoLibrary } from "./BackendVideoLibrary";
import { VideoStage } from "./VideoStage";

const DEFAULT_LIBRARY_NAVIGATION_QUERY: LibraryNavigationQuery = {
  sortBy: "addedAt",
  sortDirection: "desc",
};

interface LibraryRouteState {
  libraryNavigationQuery?: LibraryNavigationQuery;
}

function getLibraryRouteState(state: unknown): LibraryRouteState | null {
  if (typeof state !== "object" || state === null) {
    return null;
  }

  return state as LibraryRouteState;
}

export function VideoWorkspace() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isFocusMode, enterFocusMode, exitFocusMode } =
    useOutletContext<AppShellOutletContext>();
  const { libraryVideoId } = useParams();

  useEffect(
    () => () => {
      exitFocusMode();
    },
    [exitFocusMode],
  );

  const playerRef = useRef<HTMLVideoElement | null>(null);

  const workspaceScrollRef = useRef<HTMLDivElement | null>(null);

  const videoStageFocusRef = useRef<HTMLDivElement | null>(null);

  const lastTrackedSecondRef = useRef<number | null>(null);

  const skipNextSeekRef = useRef(false);

  const pendingSeekTimestampRef = useRef<number | null>(null);

  const synchronizedTimestampRef = useRef<number | undefined>(undefined);

  const [playerReadyVersion, setPlayerReadyVersion] = useState(0);

  /*
   * A detail route may point to a Video outside the
   * currently loaded Library page. Keep that exact
   * route Video locally so a later paged Library load
   * cannot remove the active Workspace source.
   */
  const [routeVideo, setRouteVideo] = useState<LibraryVideo | null>(null);

  const [resolvedRouteVideoId, setResolvedRouteVideoId] = useState<
    number | null
  >(null);

  const [failedRouteVideoId, setFailedRouteVideoId] = useState<number | null>(
    null,
  );

  const [resolvedVideoNeighbors, setResolvedVideoNeighbors] = useState<{
    requestKey: string;
    neighbors: LibraryVideoNeighbors;
  } | null>(null);

  const [visibleLibraryNavigationQuery, setVisibleLibraryNavigationQuery] =
    useState<LibraryNavigationQuery>(DEFAULT_LIBRARY_NAVIGATION_QUERY);

  const activeContext = useContextStore((state) => state.activeContext);

  const setActiveContext = useContextStore((state) => state.setActiveContext);

  const clearActiveContext = useContextStore(
    (state) => state.clearActiveContext,
  );

  const setTimestamp = useContextStore((state) => state.setTimestamp);

  const videos = useLibraryStore((state) => state.videos);

  const ensureVideo = useLibraryStore((state) => state.ensureVideo);

  const activeRightPanel = useLayoutStore((state) => state.activeRightPanel);

  const openRightPanel = useLayoutStore((state) => state.openRightPanel);

  const parsedRouteVideoId =
    libraryVideoId === undefined ? null : Number(libraryVideoId);

  const validRouteVideoId =
    parsedRouteVideoId !== null &&
    Number.isSafeInteger(parsedRouteVideoId) &&
    parsedRouteVideoId > 0
      ? parsedRouteVideoId
      : null;

  const isResolvingRouteVideo =
    validRouteVideoId !== null &&
    resolvedRouteVideoId !== validRouteVideoId &&
    failedRouteVideoId !== validRouteVideoId;

  const hasRouteVideoError =
    validRouteVideoId !== null && failedRouteVideoId === validRouteVideoId;

  const routeNavigationQuery = getLibraryRouteState(
    location.state,
  )?.libraryNavigationQuery;

  const neighborRequestKey =
    validRouteVideoId === null
      ? ""
      : `${validRouteVideoId}:${JSON.stringify(
          routeNavigationQuery ?? DEFAULT_LIBRARY_NAVIGATION_QUERY,
        )}`;

  /*
   * Both /library and /library/:id render this same
   * component. Clear the underlying Video context
   * before the bare Library route paints so the player,
   * summary, and right Workspace cannot retain the
   * previously open Video.
   */
  useLayoutEffect(() => {
    if (libraryVideoId !== undefined) {
      return;
    }

    lastTrackedSecondRef.current = null;
    skipNextSeekRef.current = false;
    pendingSeekTimestampRef.current = null;
    synchronizedTimestampRef.current = undefined;

    clearActiveContext();
    exitFocusMode();
  }, [libraryVideoId, clearActiveContext, exitFocusMode]);

  /*
   * Synchronize /library/:libraryVideoId with the
   * active Workspace context.
   *
   * If Reverse Context already set this same Video,
   * preserve its exact Note timestamp instead of
   * overwriting it with 0.
   */
  useEffect(() => {
    if (libraryVideoId === undefined) {
      return;
    }

    if (validRouteVideoId === null) {
      navigate("/library", {
        replace: true,
      });

      return;
    }

    let cancelled = false;

    void ensureVideo(validRouteVideoId)
      .then((video) => {
        if (cancelled) {
          return;
        }

        setRouteVideo(video);
        setResolvedRouteVideoId(validRouteVideoId);
        setFailedRouteVideoId(null);

        const currentContext = useContextStore.getState().activeContext;

        if (
          currentContext?.entityType === "video" &&
          currentContext.entityId === String(video.id)
        ) {
          return;
        }

        setActiveContext({
          entityId: String(video.id),
          entityType: "video",
          title: getLibraryVideoDisplayTitle(video),
          timestamp: 0,
        });
      })
      .catch(() => {
        // libraryStore keeps the API error.
        if (!cancelled) {
          setFailedRouteVideoId(validRouteVideoId);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    libraryVideoId,
    validRouteVideoId,
    ensureVideo,
    navigate,
    setActiveContext,
  ]);

  useEffect(() => {
    if (libraryVideoId === undefined) {
      return;
    }

    workspaceScrollRef.current?.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, [libraryVideoId]);

  useEffect(() => {
    if (validRouteVideoId === null) {
      return;
    }

    let cancelled = false;

    void getLibraryVideoNeighbors(
      validRouteVideoId,
      routeNavigationQuery ?? DEFAULT_LIBRARY_NAVIGATION_QUERY,
    )
      .then((neighbors) => {
        if (!cancelled) {
          setResolvedVideoNeighbors({
            requestKey: neighborRequestKey,
            neighbors,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResolvedVideoNeighbors({
            requestKey: neighborRequestKey,
            neighbors: {
              previous: null,
              next: null,
            },
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [validRouteVideoId, routeNavigationQuery, neighborRequestKey]);

  const activeLibraryVideoId =
    activeContext?.entityType === "video"
      ? Number(activeContext.entityId)
      : undefined;

  const activeVideoFromPage =
    activeContext?.entityType === "video"
      ? videos.find((video) => String(video.id) === activeContext.entityId)
      : undefined;

  const routeActiveVideo =
    libraryVideoId !== undefined &&
    activeContext?.entityType === "video" &&
    routeVideo !== null &&
    routeVideo.id === activeLibraryVideoId
      ? routeVideo
      : undefined;

  const activeVideo = activeVideoFromPage ?? routeActiveVideo;

  const {
    clearWatchError,
    finishWatchSession,
    prepareForVideoSwitch,
    resetAfterVideoDelete,
    startTracking,
    pauseTracking,
    waitTracking,
    endTracking,
  } = useVideoWatchTracking({
    activeLibraryVideoId,
    onVideoTransition: () => {
      lastTrackedSecondRef.current = null;
      skipNextSeekRef.current = false;
      pendingSeekTimestampRef.current = null;
      synchronizedTimestampRef.current = undefined;
    },
  });

  const isVideoUnavailable =
    activeVideo?.youtubeSource.availabilityStatus === "UNAVAILABLE";

  const videoNeighbors =
    resolvedVideoNeighbors?.requestKey === neighborRequestKey
      ? resolvedVideoNeighbors.neighbors
      : {
          previous: null,
          next: null,
        };

  const previousVideo = videoNeighbors.previous ?? undefined;

  const nextVideo = videoNeighbors.next ?? undefined;

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

    const displayTitle = getLibraryVideoDisplayTitle(activeVideo);

    if (activeContext.title === displayTitle) {
      return;
    }

    setActiveContext({
      ...activeContext,
      title: displayTitle,
    });
  }, [activeVideo, activeContext, setActiveContext]);

  /*
   * Seek player when context timestamp changes
   * manually or through reverse context.
   */
  useEffect(() => {
    const player = playerRef.current;

    if (
      !player ||
      player.readyState < 1 ||
      !activeVideo ||
      activeLibraryVideoId === undefined ||
      isVideoUnavailable
    ) {
      return;
    }

    if (typeof activeContext?.timestamp !== "number") {
      return;
    }

    if (skipNextSeekRef.current) {
      skipNextSeekRef.current = false;
      synchronizedTimestampRef.current = activeContext.timestamp;
      return;
    }

    if (synchronizedTimestampRef.current === activeContext.timestamp) {
      return;
    }

    try {
      pendingSeekTimestampRef.current = activeContext.timestamp;
      player.currentTime = activeContext.timestamp;
      synchronizedTimestampRef.current = activeContext.timestamp;
    } catch (error) {
      pendingSeekTimestampRef.current = null;
      console.error("Failed to seek video timestamp:", error);
    }
  }, [
    activeContext?.entityId,
    activeContext?.timestamp,
    activeVideo,
    activeLibraryVideoId,
    playerReadyVersion,
    isVideoUnavailable,
  ]);

  function focusVideoStage() {
    window.requestAnimationFrame(() => {
      videoStageFocusRef.current?.focus();
    });
  }

  async function handleOpenVideo(
    video: LibraryVideo,
    navigationQuery?: LibraryNavigationQuery,
  ) {
    const nextNavigationQuery =
      navigationQuery ??
      (libraryVideoId === undefined
        ? visibleLibraryNavigationQuery
        : (routeNavigationQuery ?? DEFAULT_LIBRARY_NAVIGATION_QUERY));

    await prepareForVideoSwitch(video.id);

    lastTrackedSecondRef.current = null;
    skipNextSeekRef.current = false;
    pendingSeekTimestampRef.current = null;
    synchronizedTimestampRef.current = undefined;

    clearWatchError();
    setRouteVideo(video);

    setActiveContext({
      entityId: String(video.id),
      entityType: "video",
      title: getLibraryVideoDisplayTitle(video),
      timestamp: 0,
    });

    navigate(`/library/${video.id}`, {
      state: {
        libraryNavigationQuery: nextNavigationQuery,
      } satisfies LibraryRouteState,
    });

    focusVideoStage();
  }

  async function handleCloseVideo() {
    await finishWatchSession();

    lastTrackedSecondRef.current = null;
    skipNextSeekRef.current = false;
    pendingSeekTimestampRef.current = null;
    synchronizedTimestampRef.current = undefined;

    setRouteVideo(null);
    clearActiveContext();
    exitFocusMode();

    navigate("/library");

    focusVideoStage();
  }

  function handleVideoDeleted(libraryVideoIdToDelete: number) {
    if (
      activeContext?.entityType !== "video" ||
      activeContext.entityId !== String(libraryVideoIdToDelete)
    ) {
      return;
    }

    resetAfterVideoDelete();
    setRouteVideo(null);
    pendingSeekTimestampRef.current = null;
    synchronizedTimestampRef.current = undefined;
    clearActiveContext();
    exitFocusMode();

    navigate("/library", {
      replace: true,
    });

    focusVideoStage();
  }

  function handleEnterFocusMode() {
    enterFocusMode();
    focusVideoStage();
  }

  function handleExitFocusMode() {
    exitFocusMode();
    focusVideoStage();
  }

  function handlePlayerPlaying() {
    if (!activeVideo || isVideoUnavailable) {
      return;
    }

    startTracking(activeVideo.id);
  }

  function handleTrackVideoTime(currentTime: number) {
    if (!activeVideo || isVideoUnavailable) {
      return;
    }

    const pendingTimestamp = pendingSeekTimestampRef.current;

    if (pendingTimestamp !== null) {
      if (Math.abs(currentTime - pendingTimestamp) > 1) {
        return;
      }

      pendingSeekTimestampRef.current = null;
    }

    const currentSecond = Math.floor(currentTime);

    if (lastTrackedSecondRef.current === currentSecond) {
      return;
    }

    lastTrackedSecondRef.current = currentSecond;

    skipNextSeekRef.current = true;

    setTimestamp(currentTime);
  }

  function handlePlayerReady(initialTimestamp?: number) {
    if (!activeVideo) {
      return;
    }

    pendingSeekTimestampRef.current = null;
    synchronizedTimestampRef.current = initialTimestamp;
    setPlayerReadyVersion((version) => version + 1);
  }

  function handlePlayerSeeked(currentTime: number) {
    const pendingTimestamp = pendingSeekTimestampRef.current;

    if (
      pendingTimestamp !== null &&
      Math.abs(currentTime - pendingTimestamp) > 1
    ) {
      return;
    }

    pendingSeekTimestampRef.current = null;
    handleTrackVideoTime(currentTime);
  }

  function handleTimestampChange(seconds: number) {
    if (!activeVideo) {
      return;
    }

    const currentContext = useContextStore.getState().activeContext;

    if (
      currentContext?.entityType !== "video" ||
      currentContext.entityId !== String(activeVideo.id)
    ) {
      return;
    }

    const baseTimestamp =
      pendingSeekTimestampRef.current ?? currentContext.timestamp ?? 0;

    const nextTimestamp = Math.max(0, baseTimestamp + seconds);

    pendingSeekTimestampRef.current = nextTimestamp;
    setTimestamp(nextTimestamp);
  }

  return (
    <div
      ref={workspaceScrollRef}
      className="no-scrollbar min-w-0 flex-1 overflow-y-auto p-4 sm:p-6"
    >
      <div className="mx-auto max-w-7xl">
        <div
          ref={videoStageFocusRef}
          role="group"
          aria-label="Video workspace"
          tabIndex={-1}
          className="rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
        >
          <VideoStage
            activeVideo={activeVideo}
            firstVideo={videos[0]}
            isVideoUnavailable={isVideoUnavailable}
            isResolvingVideo={isResolvingRouteVideo}
            hasVideoLoadError={hasRouteVideoError}
            playerRef={playerRef}
            onOpenVideo={(video) => void handleOpenVideo(video)}
            onCloseVideo={() => void handleCloseVideo()}
            onTimeUpdate={handleTrackVideoTime}
            onPlayerReady={handlePlayerReady}
            onSeeked={handlePlayerSeeked}
            onPlaying={handlePlayerPlaying}
            onPause={pauseTracking}
            onWaiting={waitTracking}
            onEnded={endTracking}
            timestamp={activeContext?.timestamp}
            previousVideo={previousVideo}
            nextVideo={nextVideo}
            onDecreaseTimestamp={() => handleTimestampChange(-10)}
            onIncreaseTimestamp={() => handleTimestampChange(10)}
            onEnterFocus={
              activeVideo && !isFocusMode ? handleEnterFocusMode : undefined
            }
            isFocusMode={isFocusMode}
            onExitFocus={handleExitFocusMode}
            onOpenWorkspace={
              isFocusMode && activeRightPanel !== "tools"
                ? () => openRightPanel("tools")
                : undefined
            }
          />
        </div>

        <div className="mt-4">
          <ContextSummary />
        </div>

        <div className={`mt-4 w-full ${isFocusMode ? "xl:hidden" : ""}`}>
          <BackendVideoLibrary
            activeVideoId={
              Number.isFinite(activeLibraryVideoId)
                ? activeLibraryVideoId
                : undefined
            }
            onOpenVideo={(video, navigationQuery) =>
              void handleOpenVideo(video, navigationQuery)
            }
            onNavigationQueryChange={setVisibleLibraryNavigationQuery}
            onVideoDeleted={handleVideoDeleted}
          />
        </div>
      </div>
    </div>
  );
}
