import { apiGet } from "../../../lib/api";

import type { Note } from "../../notes/services/noteApi";
import type { Task } from "../../todo/services/taskApi";

export type ContextNavigationMode =
  | "WORKSPACE"
  | "SOURCE_PREVIEW"
  | "VIDEO_UNAVAILABLE"
  | "SOURCE_MISSING"
  | "NO_SOURCE";

export interface ContextResponse {
  navigationMode: ContextNavigationMode;

  task: Task | null;
  note: Note | null;

  libraryVideoId: number | null;
}

export function resolveContextFromNote(
  noteId: number,
) {
  return apiGet<ContextResponse>(
    `/api/context/notes/${noteId}`,
  );
}

export function resolveContextFromTask(
  taskId: number,
) {
  return apiGet<ContextResponse>(
    `/api/context/tasks/${taskId}`,
  );
}