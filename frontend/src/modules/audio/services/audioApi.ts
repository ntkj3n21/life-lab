import {
  apiDelete,
  apiGet,
  apiPost,
  apiPostMultipart,
} from "../../../lib/api";

import type { PagedResponse } from "../../media/services/libraryApi";

export type AudioOrigin =
  | "EXTERNAL"
  | "UPLOAD";

export interface LibraryAudio {
  id: number;
  sourceId: number;
  origin: AudioOrigin;
  url: string | null;
  originalFilename: string | null;
  mediaType: string | null;
  sizeBytes: number | null;
  title: string | null;
  addedAt: string;
}

export interface AudioLibraryQuery {
  page?: number;
  size?: number;
}

export interface CreateAudioInput {
  url: string;
  title: string | null;
}

export function getAudioLibrary(
  query: AudioLibraryQuery = {},
) {
  const params = new URLSearchParams();

  if (query.page !== undefined) {
    params.set("page", String(query.page));
  }

  if (query.size !== undefined) {
    params.set("size", String(query.size));
  }

  const queryString = params.toString();

  return apiGet<PagedResponse<LibraryAudio>>(
    `/api/library/audio${
      queryString ? `?${queryString}` : ""
    }`,
  );
}

export function getLibraryAudio(audioId: number) {
  return apiGet<LibraryAudio>(
    `/api/library/audio/${audioId}`,
  );
}

export function addAudioUrl(input: CreateAudioInput) {
  return apiPost<LibraryAudio, CreateAudioInput>(
    "/api/library/audio/url",
    input,
  );
}

export function uploadAudio(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return apiPostMultipart<LibraryAudio>(
    "/api/library/audio/upload",
    formData,
  );
}

export function removeLibraryAudio(audioId: number) {
  return apiDelete(`/api/library/audio/${audioId}`);
}

export function getLibraryAudioTitle(audio: LibraryAudio) {
  return (
    audio.title?.trim() ||
    audio.originalFilename?.trim() ||
    audio.url?.trim() ||
    "Audio"
  );
}

export function getAudioContentUrl(
  sourceId: number,
) {
  return `/api/audio/${sourceId}/content`;
}

export function getAudioPlaybackUrl(
  sourceId: number,
  origin: AudioOrigin,
  url: string | null,
): string {
  return origin === "UPLOAD"
    ? getAudioContentUrl(sourceId)
    : url ?? "";
}
