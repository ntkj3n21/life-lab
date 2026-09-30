import { apiDelete, apiGet, apiPatch, apiPost, apiPostMultipart, apiPut } from "../../../lib/api";

import type { PagedResponse } from "../../media/services/libraryApi";
import type { Tag } from "../../media/services/tagApi";

export type AudioOrigin = "EXTERNAL" | "UPLOAD";

export interface LibraryAudio {
  id: number;
  sourceId: number;
  origin: AudioOrigin;
  url: string | null;
  originalFilename: string | null;
  mediaType: string | null;
  sizeBytes: number | null;
  title: string | null;
  personalDescription: string | null;
  tags: Tag[];
  addedAt: string;
}

export interface AudioLibraryQuery {
  page?: number;
  size?: number;
  q?: string;
  tagIds?: number[];
  hasNotes?: boolean;
  origin?: AudioOrigin;
  addedFrom?: string;
  addedTo?: string;
  sortBy?: "addedAt" | "title";
  sortDirection?: "asc" | "desc";
}

export interface UpdateLibraryAudioInput {
  title: string | null;
  personalDescription: string | null;
}

export interface CreateAudioInput {
  url: string;
  title: string | null;
}

export function getAudioLibrary(query: AudioLibraryQuery = {}) {
  const params = new URLSearchParams();

  if (query.page !== undefined) {
    params.set("page", String(query.page));
  }

  if (query.size !== undefined) {
    params.set("size", String(query.size));
  }

  if (query.q?.trim()) {
    params.set("q", query.q.trim());
  }

  query.tagIds?.forEach((tagId) => params.append("tagId", String(tagId)));
  if (query.hasNotes !== undefined) params.set("hasNotes", String(query.hasNotes));
  if (query.origin) params.set("origin", query.origin);
  if (query.addedFrom) params.set("addedFrom", query.addedFrom);
  if (query.addedTo) params.set("addedTo", query.addedTo);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDirection) params.set("sortDirection", query.sortDirection);

  const queryString = params.toString();

  return apiGet<PagedResponse<LibraryAudio>>(
    `/api/library/audio${queryString ? `?${queryString}` : ""}`,
  );
}

export function getLibraryAudio(audioId: number) {
  return apiGet<LibraryAudio>(`/api/library/audio/${audioId}`);
}

export function updateLibraryAudio(audioId: number, input: UpdateLibraryAudioInput) {
  return apiPatch<LibraryAudio, UpdateLibraryAudioInput>(`/api/library/audio/${audioId}`, input);
}

export function getLibraryAudioTags(audioId: number) {
  return apiGet<Tag[]>(`/api/library/audio/${audioId}/tags`);
}

export function attachTagToAudio(audioId: number, tagId: number) {
  return apiPut<void>(`/api/library/audio/${audioId}/tags/${tagId}`);
}

export function detachTagFromAudio(audioId: number, tagId: number) {
  return apiDelete(`/api/library/audio/${audioId}/tags/${tagId}`);
}

export function addAudioUrl(input: CreateAudioInput) {
  return apiPost<LibraryAudio, CreateAudioInput>(
    "/api/library/audio/url",
    input,
  );
}

export function uploadAudio(file: File, title: string | null = null) {
  const formData = new FormData();

  formData.set("file", file);

  if (title?.trim()) {
    formData.set("title", title.trim());
  }

  return apiPostMultipart<LibraryAudio>("/api/library/audio/upload", formData);
}

export function removeLibraryAudio(audioId: number) {
  return apiDelete(`/api/library/audio/${audioId}`);
}

export function getLibraryAudioTitle(audio: LibraryAudio) {
  return (
    audio.title?.trim() ||
    audio.originalFilename?.trim() ||
    (audio.origin === "EXTERNAL" ? "External audio" : "Audio")
  );
}

export function getAudioContentUrl(sourceId: number) {
  return `/api/audio/${sourceId}/content`;
}

export function getAudioPlaybackUrl(
  sourceId: number,
  origin: AudioOrigin,
  url: string | null,
): string {
  return origin === "UPLOAD" ? getAudioContentUrl(sourceId) : (url ?? "");
}
