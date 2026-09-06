import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from "../../../lib/api";

import type {
  PagedResponse,
  YouTubeVideo,
} from "../../media/services/libraryApi";

export interface Note {
  id: number;
  youtubeSource: YouTubeVideo;
  content: string;
  timestampSeconds: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  content: string;
  timestampSeconds: number | null;
  withoutTimestampConfirmed: boolean;
}

export interface UpdateNoteInput {
  content: string;
}

export interface NoteDeleteImpact {
  noteId: number;
  taskCountToMarkSourceMissing: number;
  tasksPreserved: boolean;
  youtubeSourcePreserved: boolean;
}

export interface NoteQuery {
  page?: number;
  size?: number;
  q?: string;
}

function buildNoteQuery(
  query: NoteQuery = {},
) {
  const params =
    new URLSearchParams();

  if (query.page !== undefined) {
    params.set(
      "page",
      String(query.page),
    );
  }

  if (query.size !== undefined) {
    params.set(
      "size",
      String(query.size),
    );
  }

  if (query.q?.trim()) {
    params.set(
      "q",
      query.q.trim(),
    );
  }

  const value =
    params.toString();

  return value
    ? `?${value}`
    : "";
}

export function getNotes(
  query: NoteQuery = {},
) {
  return apiGet<
    PagedResponse<Note>
  >(
    `/api/notes${buildNoteQuery(
      query,
    )}`,
  );
}

export function getNote(
  noteId: number,
) {
  return apiGet<Note>(
    `/api/notes/${noteId}`,
  );
}

export function getVideoNotes(
  libraryVideoId: number,
) {
  return apiGet<Note[]>(
    `/api/library/videos/${libraryVideoId}/notes`,
  );
}

export function createNote(
  libraryVideoId: number,
  input: CreateNoteInput,
) {
  return apiPost<
    Note,
    CreateNoteInput
  >(
    `/api/library/videos/${libraryVideoId}/notes`,
    input,
  );
}

export function updateNote(
  noteId: number,
  input: UpdateNoteInput,
) {
  return apiPatch<
    Note,
    UpdateNoteInput
  >(
    `/api/notes/${noteId}`,
    input,
  );
}

export function getNoteDeleteImpact(
  noteId: number,
) {
  return apiGet<NoteDeleteImpact>(
    `/api/notes/${noteId}/delete-impact`,
  );
}

export function deleteNote(
  noteId: number,
) {
  return apiDelete(
    `/api/notes/${noteId}`,
  );
}