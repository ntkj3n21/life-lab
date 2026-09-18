import {
  apiDelete,
  apiGet,
  apiPost,
  apiPostMultipart,
} from "../../../lib/api";

import type { PagedResponse } from "../../media/services/libraryApi";

export type ImageOrigin =
  | "EXTERNAL"
  | "UPLOAD";

export interface LibraryImage {
  id: number;
  sourceId: number;
  origin: ImageOrigin;
  url: string | null;
  originalFilename: string | null;
  mediaType: string | null;
  sizeBytes: number | null;
  addedAt: string;
}

export interface ImageLibraryQuery {
  page?: number;
  size?: number;
}

export function getImageLibrary(
  query: ImageLibraryQuery = {},
) {
  const params = new URLSearchParams();

  if (query.page !== undefined) {
    params.set("page", String(query.page));
  }

  if (query.size !== undefined) {
    params.set("size", String(query.size));
  }

  const queryString = params.toString();

  return apiGet<PagedResponse<LibraryImage>>(
    `/api/library/images${
      queryString ? `?${queryString}` : ""
    }`,
  );
}

export function getLibraryImage(
  imageId: number,
) {
  return apiGet<LibraryImage>(
    `/api/library/images/${imageId}`,
  );
}

export function addExternalImage(
  url: string,
) {
  return apiPost<
    LibraryImage,
    { url: string }
  >("/api/library/images/url", {
    url,
  });
}

export function uploadImage(file: File) {
  const formData = new FormData();
  formData.set("file", file);

  return apiPostMultipart<LibraryImage>(
    "/api/library/images/upload",
    formData,
  );
}

export function removeLibraryImage(
  imageId: number,
) {
  return apiDelete(
    `/api/library/images/${imageId}`,
  );
}

export function getLibraryImageTitle(
  image: LibraryImage,
) {
  return (
    image.originalFilename?.trim() ||
    image.url?.trim() ||
    "Image"
  );
}

export function getImageContentUrl(
  sourceId: number,
) {
  return `/api/images/${sourceId}/content`;
}
