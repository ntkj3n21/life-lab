import { create } from "zustand";

import { ApiError } from "../lib/api";
import {
  attachTagToVideo,
  createTag as createTagRequest,
  deleteTag as deleteTagRequest,
  detachTagFromVideo,
  getTagDeleteImpact,
  getTags,
  getVideoTags,
  renameTag as renameTagRequest,
  type Tag,
  type TagDeleteImpact,
} from "../modules/media/services/tagApi";

interface TagStore {
  tags: Tag[];

  videoTags: Record<number, Tag[]>;

  hasLoadedTags: boolean;

  isLoading: boolean;
  isMutating: boolean;

  error: ApiError | null;

  loadTags: (
    force?: boolean,
  ) => Promise<Tag[]>;

  loadVideoTags: (
    libraryVideoId: number,
  ) => Promise<Tag[]>;

  createTag: (
    name: string,
  ) => Promise<Tag>;

  renameTag: (
    tagId: number,
    name: string,
  ) => Promise<Tag>;

  getDeleteImpact: (
    tagId: number,
  ) => Promise<TagDeleteImpact>;

  deleteTag: (
    tagId: number,
  ) => Promise<void>;

  attachTag: (
    libraryVideoId: number,
    tagId: number,
  ) => Promise<void>;

  detachTag: (
    libraryVideoId: number,
    tagId: number,
  ) => Promise<void>;

  clearError: () => void;
  reset: () => void;
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(0, {
    code: "UNKNOWN_ERROR",
    message: "Something went wrong.",
    fieldErrors: {},
  });
}

const initialState = {
  tags: [] as Tag[],

  videoTags: {} as Record<number, Tag[]>,

  hasLoadedTags: false,

  isLoading: false,
  isMutating: false,

  error: null as ApiError | null,
};

export const useTagStore = create<TagStore>(
  (set, get) => ({
    ...initialState,

    loadTags: async (force = false) => {
      if (
        get().hasLoadedTags &&
        !force
      ) {
        return get().tags;
      }

      set({
        isLoading: true,
        error: null,
      });

      try {
        const tags = await getTags();

        set({
          tags,
          hasLoadedTags: true,
        });

        return tags;
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      } finally {
        set({
          isLoading: false,
        });
      }
    },

    loadVideoTags: async (
      libraryVideoId,
    ) => {
      set({
        error: null,
      });

      try {
        const tags =
          await getVideoTags(
            libraryVideoId,
          );

        set((state) => ({
          videoTags: {
            ...state.videoTags,
            [libraryVideoId]: tags,
          },
        }));

        return tags;
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      }
    },

    createTag: async (name) => {
      set({
        isMutating: true,
        error: null,
      });

      try {
        const tag =
          await createTagRequest({
            name: name.trim(),
          });

        set((state) => ({
          tags: [...state.tags, tag].sort(
            (a, b) =>
              a.name.localeCompare(
                b.name,
                undefined,
                {
                  sensitivity: "base",
                },
              ),
          ),
        }));

        return tag;
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      } finally {
        set({
          isMutating: false,
        });
      }
    },

    renameTag: async (
      tagId,
      name,
    ) => {
      set({
        isMutating: true,
        error: null,
      });

      try {
        const updatedTag =
          await renameTagRequest(
            tagId,
            {
              name: name.trim(),
            },
          );

        set((state) => {
          const replaceTag = (
            tags: Tag[],
          ) =>
            tags
              .map((tag) =>
                tag.id === tagId
                  ? updatedTag
                  : tag,
              )
              .sort((a, b) =>
                a.name.localeCompare(
                  b.name,
                  undefined,
                  {
                    sensitivity: "base",
                  },
                ),
              );

          const nextVideoTags =
            Object.fromEntries(
              Object.entries(
                state.videoTags,
              ).map(
                ([
                  libraryVideoId,
                  tags,
                ]) => [
                  libraryVideoId,
                  replaceTag(tags),
                ],
              ),
            ) as Record<
              number,
              Tag[]
            >;

          return {
            tags: replaceTag(
              state.tags,
            ),
            videoTags:
              nextVideoTags,
          };
        });

        return updatedTag;
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      } finally {
        set({
          isMutating: false,
        });
      }
    },

    getDeleteImpact: async (
      tagId,
    ) => {
      set({
        error: null,
      });

      try {
        return await getTagDeleteImpact(
          tagId,
        );
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      }
    },

    deleteTag: async (tagId) => {
      set({
        isMutating: true,
        error: null,
      });

      try {
        await deleteTagRequest(tagId);

        set((state) => {
          const nextVideoTags =
            Object.fromEntries(
              Object.entries(
                state.videoTags,
              ).map(
                ([
                  libraryVideoId,
                  tags,
                ]) => [
                  libraryVideoId,
                  tags.filter(
                    (tag) =>
                      tag.id !== tagId,
                  ),
                ],
              ),
            ) as Record<
              number,
              Tag[]
            >;

          return {
            tags: state.tags.filter(
              (tag) =>
                tag.id !== tagId,
            ),
            videoTags:
              nextVideoTags,
          };
        });
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      } finally {
        set({
          isMutating: false,
        });
      }
    },

    attachTag: async (
      libraryVideoId,
      tagId,
    ) => {
      set({
        isMutating: true,
        error: null,
      });

      try {
        await attachTagToVideo(
          libraryVideoId,
          tagId,
        );

        const tag = get().tags.find(
          (candidate) =>
            candidate.id === tagId,
        );

        if (!tag) {
          await get().loadVideoTags(
            libraryVideoId,
          );

          return;
        }

        set((state) => {
          const current =
            state.videoTags[
              libraryVideoId
            ] ?? [];

          if (
            current.some(
              (candidate) =>
                candidate.id === tagId,
            )
          ) {
            return state;
          }

          return {
            videoTags: {
              ...state.videoTags,
              [libraryVideoId]: [
                ...current,
                tag,
              ].sort((a, b) =>
                a.name.localeCompare(
                  b.name,
                  undefined,
                  {
                    sensitivity: "base",
                  },
                ),
              ),
            },
          };
        });
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      } finally {
        set({
          isMutating: false,
        });
      }
    },

    detachTag: async (
      libraryVideoId,
      tagId,
    ) => {
      set({
        isMutating: true,
        error: null,
      });

      try {
        await detachTagFromVideo(
          libraryVideoId,
          tagId,
        );

        set((state) => ({
          videoTags: {
            ...state.videoTags,
            [libraryVideoId]: (
              state.videoTags[
                libraryVideoId
              ] ?? []
            ).filter(
              (tag) =>
                tag.id !== tagId,
            ),
          },
        }));
      } catch (error) {
        const apiError = toApiError(error);

        set({
          error: apiError,
        });

        throw apiError;
      } finally {
        set({
          isMutating: false,
        });
      }
    },

    clearError: () => {
      set({
        error: null,
      });
    },

    reset: () => {
      set({
        ...initialState,
      });
    },
  }),
);