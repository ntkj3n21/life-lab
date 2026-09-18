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
import type { Tag } from "../../media/services/tagApi";
import type { Category } from "../../organization/services/categoryApi";

export interface Note {
  id: number;
  sourceType:
    | "YOUTUBE"
    | "IMAGE"
    | "AUDIO";
  youtubeSource: YouTubeVideo | null;
  imageSource: ImageSource | null;
  audioSource: AudioSource | null;
  content: string;
  timestampSeconds: number | null;
  category: Category | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface ImageSource {
  id: number;
  origin: "EXTERNAL" | "UPLOAD";
  url: string | null;
  originalFilename: string | null;
  mediaType: string | null;
  sizeBytes: number | null;
}

export interface AudioSource {
  id: number;
  origin: "EXTERNAL" | "UPLOAD";
  url: string | null;
  originalFilename: string | null;
  mediaType: string | null;
  sizeBytes: number | null;
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
  sourcePreserved: boolean;
}

export interface NoteQuery {
  page?: number;
  size?: number;
  q?: string;
  categoryId?: number;
  tagIds?: number[];
  hasTimestamp?: boolean;
  sortBy?:
    | "createdAt"
    | "updatedAt";
  sortDirection?: "asc" | "desc";
}

export interface CreateImageNoteInput {
  content: string;
}

export interface UpdateNoteOrganizationInput {
  categoryId: number | null;
  tagIds: number[];
}

export interface NoteOrganization {
  category: Category | null;
  tags: Tag[];
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

  if (
    query.categoryId !== undefined
  ) {
    params.set(
      "categoryId",
      String(query.categoryId),
    );
  }

  query.tagIds?.forEach(
    (tagId) => {
      params.append(
        "tagId",
        String(tagId),
      );
    },
  );

  if (
    query.hasTimestamp !==
    undefined
  ) {
    params.set(
      "hasTimestamp",
      String(query.hasTimestamp),
    );
  }

  if (query.sortBy) {
    params.set(
      "sortBy",
      query.sortBy,
    );
  }

  if (query.sortDirection) {
    params.set(
      "sortDirection",
      query.sortDirection,
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

export function updateNoteOrganization(
  noteId: number,
  input: UpdateNoteOrganizationInput,
) {
  return apiPatch<
    NoteOrganization,
    UpdateNoteOrganizationInput
  >(
    `/api/notes/${noteId}/organization`,
    input,
  );
}

export function getNoteSourceTitle(
  note: Note,
) {
  if (note.sourceType === "IMAGE") {
    return (
      note.imageSource?.originalFilename?.trim() ||
      note.imageSource?.url?.trim() ||
      "Image"
    );
  }

  if (note.sourceType === "AUDIO") {
    return (
      note.audioSource?.originalFilename?.trim() ||
      note.audioSource?.url?.trim() ||
      "Audio"
    );
  }

  return (
    note.youtubeSource?.title ??
    "YouTube video"
  );
}

export function getNoteSourceLabel(
  note: Note,
) {
  switch (note.sourceType) {
    case "IMAGE":
      return "Image";
    case "AUDIO":
      return "Audio";
    case "YOUTUBE":
      return "Video";
  }
}

export function getNoteSourceRecordLabel(
  note: Note,
) {
  return note.sourceType === "YOUTUBE"
    ? "YouTube"
    : getNoteSourceLabel(note);
}

export function getImageNotes(
  imageId: number,
) {
  return apiGet<Note[]>(
    `/api/library/images/${imageId}/notes`,
  );
}

export function createImageNote(
  imageId: number,
  input: CreateImageNoteInput,
) {
  return apiPost<
    Note,
    CreateImageNoteInput
  >(
    `/api/library/images/${imageId}/notes`,
    input,
  );
}

export function getAudioNotes(
  audioId: number,
) {
  return apiGet<Note[]>(
    `/api/library/audio/${audioId}/notes`,
  );
}

export function createAudioNote(
  audioId: number,
  input: CreateNoteInput,
) {
  return apiPost<
    Note,
    CreateNoteInput
  >(
    `/api/library/audio/${audioId}/notes`,
    input,
  );
}
