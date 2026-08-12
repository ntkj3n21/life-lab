import {
  useCallback,
} from "react";

import {
  navigateToPath,
} from "../../../lib/navigation";

import {
  useContextStore,
} from "../../../stores/contextStore";

import {
  useLibraryStore,
} from "../../../stores/libraryStore";

import {
  useReverseContextStore,
} from "../../../stores/reverseContextStore";

import {
  getLibraryVideoDisplayTitle,
} from "../../media/services/libraryApi";

import type {
  ContextResponse,
} from "../services/contextApi";

export function useReverseContextNavigation() {
  const setActiveContext =
    useContextStore(
      (state) =>
        state.setActiveContext,
    );

  const ensureVideo =
    useLibraryStore(
      (state) =>
        state.ensureVideo,
    );

  const resolveNote =
    useReverseContextStore(
      (state) =>
        state.resolveNote,
    );

  const resolveTask =
    useReverseContextStore(
      (state) =>
        state.resolveTask,
    );

  const applyResolution =
    useCallback(
      async (
        resolution:
          ContextResponse,
      ) => {
        switch (
          resolution.navigationMode
        ) {
          case "WORKSPACE": {
            if (
              !resolution.note ||
              resolution.libraryVideoId ===
                null
            ) {
              return;
            }

            const video =
              await ensureVideo(
                resolution.libraryVideoId,
              );

            setActiveContext({
              entityId:
                String(
                  video.id,
                ),

              entityType:
                "video",

              title:
                getLibraryVideoDisplayTitle(
                  video,
                ),

              /*
               * null means the Note had
               * no timestamp.
               *
               * Never guess a seek
               * position.
               */
              timestamp:
                resolution.note
                  .timestampSeconds ??
                undefined,
            });

            navigateToPath(
              "/",
            );

            return;
          }

          case "SOURCE_PREVIEW":
          case "VIDEO_UNAVAILABLE": {
            if (
              !resolution.note
            ) {
              return;
            }

            navigateToPath(
              `/notes/${resolution.note.id}/source`,
            );

            return;
          }

          case "SOURCE_MISSING": {
            window.alert(
              "The original Note no longer exists. The Task is preserved, but its source cannot be restored.",
            );

            return;
          }

          case "NO_SOURCE": {
            window.alert(
              "This is an independent Task and has no source Note or Video.",
            );

            return;
          }
        }
      },
      [
        ensureVideo,
        setActiveContext,
      ],
    );

  const openNoteContext =
    useCallback(
      async (
        noteId: number,
      ) => {
        const resolution =
          await resolveNote(
            noteId,
          );

        await applyResolution(
          resolution,
        );

        return resolution;
      },
      [
        resolveNote,
        applyResolution,
      ],
    );

  const openTaskContext =
    useCallback(
      async (
        taskId: number,
      ) => {
        const resolution =
          await resolveTask(
            taskId,
          );

        await applyResolution(
          resolution,
        );

        return resolution;
      },
      [
        resolveTask,
        applyResolution,
      ],
    );

  return {
    openNoteContext,
    openTaskContext,
    applyResolution,
  };
}