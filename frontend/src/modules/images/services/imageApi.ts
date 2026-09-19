import { apiDelete, apiGet, apiPost, apiPostMultipart } from "../../../lib/api";

import type { PagedResponse } from "../../media/services/libraryApi";

export type ImageOrigin = "EXTERNAL" | "UPLOAD";

export interface LibraryImage {
  id: number;
  sourceId: number;
  origin: ImageOrigin;
  url: string | null;
  originalFilename: string | null;
  mediaType: string | null;
  sizeBytes: number | null;
  title: string | null;
  addedAt: string;
}

export interface ImageLibraryQuery {
  page?: number;
  size?: number;
  q?: string;
}

export interface CreateExternalImageInput {
  url: string;
  title: string | null;
}

export function getImageLibrary(query: ImageLibraryQuery = {}) {
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

  const queryString = params.toString();

  return apiGet<PagedResponse<LibraryImage>>(
    `/api/library/images${queryString ? `?${queryString}` : ""}`,
  );
}

export function getLibraryImage(imageId: number) {
  return apiGet<LibraryImage>(`/api/library/images/${imageId}`);
}

export function addExternalImage(input: CreateExternalImageInput) {
  return apiPost<LibraryImage, CreateExternalImageInput>(
    "/api/library/images/url",
    input,
  );
}

export function uploadImage(file: File, title: string | null = null) {
  const formData = new FormData();

  formData.set("file", file);

  if (title?.trim()) {
    formData.set("title", title.trim());
  }

  return apiPostMultipart<LibraryImage>("/api/library/images/upload", formData);
}

export function removeLibraryImage(imageId: number) {
  return apiDelete(`/api/library/images/${imageId}`);
}

export function getLibraryImageTitle(image: LibraryImage) {
  return (
    image.title?.trim() ||
    image.originalFilename?.trim() ||
    (image.origin === "EXTERNAL" ? "External image" : "Image")
  );
}

export function getImageContentUrl(sourceId: number) {
  return `/api/images/${sourceId}/content`;
}
