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