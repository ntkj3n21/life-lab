import { apiDelete, apiGet, apiPatch, apiPost, apiPostMultipart, apiPut } from "../../../lib/api";

import type { PagedResponse } from "../../media/services/libraryApi";
import type { Tag } from "../../media/services/tagApi";

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
  personalDescription: string | null;
  tags: Tag[];
  addedAt: string;
}

export interface ImageLibraryQuery {
  page?: number;
  size?: number;
  q?: string;
  tagIds?: number[];
  hasNotes?: boolean;
  origin?: ImageOrigin;
  addedFrom?: string;
  addedTo?: string;
  sortBy?: "addedAt" | "title";
  sortDirection?: "asc" | "desc";
}

export interface UpdateLibraryImageInput {
  title: string | null;
  personalDescription: string | null;
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

  query.tagIds?.forEach((tagId) => params.append("tagId", String(tagId)));
  if (query.hasNotes !== undefined) params.set("hasNotes", String(query.hasNotes));
  if (query.origin) params.set("origin", query.origin);
  if (query.addedFrom) params.set("addedFrom", query.addedFrom);
  if (query.addedTo) params.set("addedTo", query.addedTo);
  if (query.sortBy) params.set("sortBy", query.sortBy);
  if (query.sortDirection) params.set("sortDirection", query.sortDirection);

  const queryString = params.toString();

  return apiGet<PagedResponse<LibraryImage>>(
    `/api/library/images${queryString ? `?${queryString}` : ""}`,
  );
}

export function getLibraryImage(imageId: number) {
  return apiGet<LibraryImage>(`/api/library/images/${imageId}`);
}

export function updateLibraryImage(imageId: number, input: UpdateLibraryImageInput) {
  return apiPatch<LibraryImage, UpdateLibraryImageInput>(`/api/library/images/${imageId}`, input);
}

export function getLibraryImageTags(imageId: number) {
  return apiGet<Tag[]>(`/api/library/images/${imageId}/tags`);
}

export function attachTagToImage(imageId: number, tagId: number) {
  return apiPut<void>(`/api/library/images/${imageId}/tags/${tagId}`);
}

export function detachTagFromImage(imageId: number, tagId: number) {
  return apiDelete(`/api/library/images/${imageId}/tags/${tagId}`);
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
