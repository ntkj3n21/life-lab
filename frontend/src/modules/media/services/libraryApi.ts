import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from "../../../lib/api";

export type YouTubeAvailabilityStatus =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "UNKNOWN";

export interface YouTubeVideo {
  id: number;
  youtubeVideoId: string;
  sourceUrl: string;
  title: string | null;
  channelName: string | null;
  thumbnailUrl: string | null;
  durationSeconds: number | null;
  publishedAt: string | null;
  availabilityStatus: YouTubeAvailabilityStatus;
}

export interface LibraryVideo {
  id: number;
  youtubeSource: YouTubeVideo;

  customTitle: string | null;
  personalDescription: string | null;

  addedAt: string;
  updatedAt: string;

  /*
   * Derived from VALID WatchSessions only.
   * These values are not persisted in library_videos.
   */
  watched: boolean;
  viewCount: number;
  lastWatchedAt: string | null;
}

export interface PagedResponse<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export interface AddLibraryVideoInput {
  youtubeUrl: string;
}

export interface UpdateLibraryVideoInput {
  customTitle: string | null;
  personalDescription: string | null;
}

export interface LibraryVideoDeleteImpact {
  libraryVideoId: number;
  watchSessionCountToDelete: number;
  tagLinkCountToDelete: number;
  noteCountPreserved: number;
  taskCountPreserved: number;
  youtubeSourcePreserved: boolean;
}

export interface LibraryQuery {
  page?: number;
  size?: number;
  q?: string;

  minDurationSeconds?: number;
  maxDurationSeconds?: number;

  publishedFrom?: string;
  publishedTo?: string;

  addedFrom?: string;
  addedTo?: string;

  tagIds?: number[];

  watched?: boolean;
  hasNotes?: boolean;

  sortBy?:
    | "addedAt"
    | "duration"
    | "viewCount"
    | "lastWatchedAt";

  sortDirection?: "asc" | "desc";
}

function buildLibraryQuery(
  query: LibraryQuery = {},
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
    query.minDurationSeconds !==
    undefined
  ) {
    params.set(
      "minDurationSeconds",
      String(
        query.minDurationSeconds,
      ),
    );
  }

  if (
    query.maxDurationSeconds !==
    undefined
  ) {
    params.set(
      "maxDurationSeconds",
      String(
        query.maxDurationSeconds,
      ),
    );
  }

  if (query.publishedFrom) {
    params.set(
      "publishedFrom",
      query.publishedFrom,
    );
  }

  if (query.publishedTo) {
    params.set(
      "publishedTo",
      query.publishedTo,
    );
  }

  if (query.addedFrom) {
    params.set(
      "addedFrom",
      query.addedFrom,
    );
  }

  if (query.addedTo) {
    params.set(
      "addedTo",
      query.addedTo,
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
    query.watched !== undefined
  ) {
    params.set(
      "watched",
      String(query.watched),
    );
  }

  if (
    query.hasNotes !== undefined
  ) {
    params.set(
      "hasNotes",
      String(query.hasNotes),
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

export function getLibrary(
  query: LibraryQuery = {},
) {
  return apiGet<
    PagedResponse<LibraryVideo>
  >(
    `/api/library/videos${buildLibraryQuery(
      query,
    )}`,
  );
}

export function getLibraryVideo(
  libraryVideoId: number,
) {
  return apiGet<LibraryVideo>(
    `/api/library/videos/${libraryVideoId}`,
  );
}

export function addLibraryVideo(
  input: AddLibraryVideoInput,
) {
  return apiPost<
    LibraryVideo,
    AddLibraryVideoInput
  >(
    "/api/library/videos",
    input,
  );
}

export function updateLibraryVideo(
  libraryVideoId: number,
  input: UpdateLibraryVideoInput,
) {
  return apiPatch<
    LibraryVideo,
    UpdateLibraryVideoInput
  >(
    `/api/library/videos/${libraryVideoId}`,
    input,
  );
}

export function getLibraryVideoDeleteImpact(
  libraryVideoId: number,
) {
  return apiGet<
    LibraryVideoDeleteImpact
  >(
    `/api/library/videos/${libraryVideoId}/delete-impact`,
  );
}

export function deleteLibraryVideo(
  libraryVideoId: number,
) {
  return apiDelete(
    `/api/library/videos/${libraryVideoId}`,
  );
}

export function getLibraryVideoDisplayTitle(
  video: LibraryVideo,
) {
  return (
    video.customTitle?.trim() ||
    video.youtubeSource.title?.trim() ||
    video.youtubeSource.youtubeVideoId
  );
}