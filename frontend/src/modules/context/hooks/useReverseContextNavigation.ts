import {
  useCallback,
} from "react";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

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

  const setNotice =
    useReverseContextStore(
      (state) =>
        state.setNotice,
    );

  const clearNotice =
    useReverseContextStore(
      (state) =>
        state.clearNotice,
    );

  const applyResolution =
    useCallback(
      async (
        resolution:
          ContextResponse,
      ) => {
        /*
         * A new reverse-context result replaces any
         * notice from the previous navigation attempt.
         */
        clearNotice();

        switch (
          resolution.navigationMode
        ) {
          case "WORKSPACE": {
            if (!resolution.note) {
              return;
            }

            if (
              resolution.note.sourceType ===
              "IMAGE"
            ) {
              if (
                resolution.libraryImageId ===
                null
              ) {
                return;
              }

              clearActiveContext();

              /*
               * Let Video workspace cleanup finish before
               * the caller can link this Image Note.
               */
              await new Promise<void>(
                (resolve) => {
                  window.setTimeout(
                    resolve,
                    0,
                  );
                },
              );

              navigate(
                `/images/${resolution.libraryImageId}`,
              );

              return;
            }

            if (
              resolution.note.sourceType ===
              "AUDIO"
            ) {
              if (
                resolution.libraryAudioId ===
                null
              ) {
                return;
              }

              clearActiveContext();

              /*
               * Settle Video workspace cleanup before an
               * awaiting caller links the exact Audio Note.
               */
              await new Promise<void>(
                (resolve) => {
                  window.setTimeout(
                    resolve,
                    0,
                  );
                },
              );

              navigate(
                `/audio/${resolution.libraryAudioId}`,
                {
                  state: {
                    audioWorkspaceRestore: {
                      libraryAudioId:
                        resolution.libraryAudioId,
                      noteId:
                        resolution.note.id,
                      timestampSeconds:
                        resolution.note.timestampSeconds,
                    },
                  },
                },
              );

              return;
            }

            if (
              resolution.note.sourceType !==
                "YOUTUBE" ||
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

            navigate(
              `/library/${video.id}`,
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

            navigate(
              `/notes/${resolution.note.id}/source`,
            );

            return;
          }

          case "SOURCE_MISSING": {
            setNotice({
              tone: "warning",
              title:
                "Original Note is missing",
              message:
                "The Task is preserved, but its original Note no longer exists, so Life Lab stops at the last determinable context instead of guessing a replacement source.",
            });

            return;
          }

          case "NO_SOURCE": {
            setNotice({
              tone: "info",
              title:
                "This Task has no source",
              message:
                "This is an independent Task, so there is no source Note, Video, or timestamp to restore.",
            });

            return;
          }
        }
      },
      [
        clearActiveContext,
        clearNotice,
        ensureVideo,
        navigate,
        setActiveContext,
        setNotice,
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
