import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import { ContextSummary } from "../../../components/context/ContextSummary";
import { useContextStore } from "../../../stores/contextStore";
import { useLibraryStore } from "../../../stores/libraryStore";
import { useVideoWatchTracking } from "../hooks/useVideoWatchTracking";
import {
  getLibraryVideoDisplayTitle,
  type LibraryVideo,
} from "../services/libraryApi";
import { BackendVideoLibrary } from "./BackendVideoLibrary";
import { CaptureTimeCard } from "./CaptureTimeCard";
import { VideoStage } from "./VideoStage";

export function VideoWorkspace() {
  const navigate = useNavigate();
  const { libraryVideoId } =
    useParams();

  const playerRef =
    useRef<HTMLVideoElement | null>(
      null,
    );

  const lastTrackedSecondRef =
    useRef<number | null>(
      null,
    );

  const skipNextSeekRef =
    useRef(false);

  /*
   * A detail route may point to a Video outside the
   * currently loaded Library page. Keep that exact
   * route Video locally so a later paged Library load
   * cannot remove the active Workspace source.
   */
  const [
    routeVideo,
    setRouteVideo,
  ] =
    useState<LibraryVideo | null>(
      null,
    );

  const activeContext =
    useContextStore(
      (state) =>
        state.activeContext,
    );

  const setActiveContext =
    useContextStore(
      (state) =>
        state.setActiveContext,
    );

  const clearActiveContext =
    useContextStore(
      (state) =>
        state.clearActiveContext,
    );

  const setTimestamp =
    useContextStore(
      (state) =>
        state.setTimestamp,
    );

  const increaseTimestamp =
    useContextStore(
      (state) =>
        state.increaseTimestamp,
    );

  const decreaseTimestamp =
    useContextStore(
      (state) =>
        state.decreaseTimestamp,
    );

  const videos =
    useLibraryStore(
      (state) => state.videos,
    );

  const ensureVideo =
    useLibraryStore(
      (state) =>
        state.ensureVideo,
    );

  /*
   * Synchronize /library/:libraryVideoId with the
   * active Workspace context.
   *
   * If Reverse Context already set this same Video,
   * preserve its exact Note timestamp instead of
   * overwriting it with 0.
   */
  useEffect(() => {
    if (
      libraryVideoId ===
      undefined
    ) {
      return;
    }

    const parsedId =
      Number(libraryVideoId);

    if (
      !Number.isSafeInteger(
        parsedId,
      ) ||
      parsedId <= 0
    ) {
      navigate("/library", {
        replace: true,
      });

      return;
    }

    let cancelled = false;

    void ensureVideo(parsedId)
      .then((video) => {
        if (cancelled) {
          return;
        }

        setRouteVideo(video);

        const currentContext =
          useContextStore
            .getState()
            .activeContext;

        if (
          currentContext
            ?.entityType ===
            "video" &&
          currentContext
            .entityId ===
            String(video.id)
        ) {
          return;
        }

        setActiveContext({
          entityId:
            String(video.id),
          entityType: "video",
          title:
            getLibraryVideoDisplayTitle(
              video,
            ),
          timestamp: 0,
        });
      })
      .catch(() => {
        // libraryStore keeps the API error.
      });

    return () => {
      cancelled = true;
    };
  }, [
    libraryVideoId,
    ensureVideo,
    navigate,
    setActiveContext,
  ]);

  const activeLibraryVideoId =
    activeContext
      ?.entityType ===
    "video"
      ? Number(
          activeContext.entityId,
        )
      : undefined;

  const activeVideoFromPage =
    activeContext
      ?.entityType ===
    "video"
      ? videos.find(
          (video) =>
            String(video.id) ===
            activeContext.entityId,
        )
      : undefined;

  const routeActiveVideo =
    libraryVideoId !== undefined &&
    activeContext?.entityType === "video" &&
    routeVideo !== null &&
    routeVideo.id === activeLibraryVideoId
      ? routeVideo
      : undefined;

  const activeVideo =
    activeVideoFromPage ??
    routeActiveVideo;

  const {
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
  } =
    useVideoWatchTracking({
      activeLibraryVideoId,
      onVideoTransition: () => {
        lastTrackedSecondRef.current =
          null;
        skipNextSeekRef.current =
          false;
      },
    });

  const isVideoUnavailable =
    activeVideo?.youtubeSource
      .availabilityStatus ===
    "UNAVAILABLE";

  const canPlayVideo =
    Boolean(activeVideo) &&
    !isVideoUnavailable;

  /*
   * Keep context title synchronized when the user
   * changes a Library video's custom title.
   */
  useEffect(() => {
    if (
      !activeVideo ||
      !activeContext
    ) {
      return;
    }

    if (
      activeContext.entityType !==
      "video"
    ) {
      return;
    }

    const displayTitle =
      getLibraryVideoDisplayTitle(
        activeVideo,
      );

    if (
      activeContext.title ===
      displayTitle
    ) {
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

  /*
   * Seek player when context timestamp changes
   * manually or through reverse context.
   */
  useEffect(() => {
    const player =
      playerRef.current;

    if (
      !player ||
      !activeVideo ||
      isVideoUnavailable
    ) {
      return;
    }

    if (
      typeof activeContext
        ?.timestamp !==
      "number"
    ) {
      return;
    }

    if (
      skipNextSeekRef.current
    ) {
      skipNextSeekRef.current =
        false;
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

  async function handleOpenVideo(
    video: LibraryVideo,
  ) {
    await prepareForVideoSwitch(
      video.id,
    );

    lastTrackedSecondRef.current =
      null;
    skipNextSeekRef.current =
      false;

    clearWatchError();
    setRouteVideo(video);

    setActiveContext({
      entityId:
        String(video.id),
      entityType: "video",
      title:
        getLibraryVideoDisplayTitle(
          video,
        ),
      timestamp: 0,
    });

    navigate(
      `/library/${video.id}`,
    );
  }

  async function handleCloseVideo() {
    await finishWatchSession();

    lastTrackedSecondRef.current =
      null;
    skipNextSeekRef.current =
      false;

    setRouteVideo(null);
    clearActiveContext();

    navigate("/library");
  }

  function handleVideoDeleted(
    libraryVideoIdToDelete: number,
  ) {
    if (
      activeContext
        ?.entityType !==
        "video" ||
      activeContext.entityId !==
        String(
          libraryVideoIdToDelete,
        )
    ) {
      return;
    }

    resetAfterVideoDelete();
    setRouteVideo(null);
    clearActiveContext();

    navigate("/library", {
      replace: true,
    });
  }

  function handlePlayerPlaying() {
    if (
      !activeVideo ||
      isVideoUnavailable
    ) {
      return;
    }

    startTracking(
      activeVideo.id,
    );
  }

  function handleTrackVideoTime(
    currentTime: number,
  ) {
    if (
      !activeVideo ||
      isVideoUnavailable
    ) {
      return;
    }

    const currentSecond =
      Math.floor(currentTime);

    if (
      lastTrackedSecondRef
        .current ===
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
    <div className="no-scrollbar min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <VideoStage
          activeVideo={
            activeVideo
          }
          firstVideo={videos[0]}
          isVideoUnavailable={
            isVideoUnavailable
          }
          playerRef={playerRef}
          onOpenVideo={(video) =>
            void handleOpenVideo(
              video,
            )
          }
          onCloseVideo={() =>
            void handleCloseVideo()
          }
          onTimeUpdate={
            handleTrackVideoTime
          }
          onPlaying={
            handlePlayerPlaying
          }
          onPause={pauseTracking}
          onWaiting={waitTracking}
          onEnded={endTracking}
        />

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.4fr]">
          <ContextSummary />

          <CaptureTimeCard
            timestamp={
              activeContext
                ?.timestamp
            }
            canPlayVideo={
              canPlayVideo
            }
            hasActiveVideo={Boolean(
              activeVideo,
            )}
            watchSession={
              watchSession
            }
            watchErrorMessage={
              watchError
                ?.message ??
              null
            }
            onDecrease={() =>
              decreaseTimestamp(5)
            }
            onReset={() =>
              setTimestamp(0)
            }
            onIncrease={() =>
              increaseTimestamp(5)
            }
          />
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
              void handleOpenVideo(
                video,
              )
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