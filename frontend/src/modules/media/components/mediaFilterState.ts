import type { ImageLibraryQuery } from "../../images/services/imageApi";

export type MediaFilter = Pick<
  ImageLibraryQuery,
  "tagIds" | "hasNotes" | "origin" | "addedFrom" | "addedTo" | "sortBy" | "sortDirection"
>;

export const DEFAULT_MEDIA_FILTER: MediaFilter = {
  sortBy: "addedAt",
  sortDirection: "desc",
};

export function hasRestrictiveMediaFilters(filter: MediaFilter) {
  return Boolean(
    filter.tagIds?.length ||
      filter.hasNotes !== undefined ||
      filter.origin ||
      filter.addedFrom ||
      filter.addedTo,
  );
}
