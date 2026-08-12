import { create } from "zustand";

import { ApiError } from "../lib/api";
import {
  addLibraryVideo,
  deleteLibraryVideo,
  getLibrary,
  getLibraryVideo,
  getLibraryVideoDeleteImpact,
  updateLibraryVideo,
  type LibraryQuery,
  type LibraryVideo,
  type LibraryVideoDeleteImpact,
  type UpdateLibraryVideoInput,
} from "../modules/media/services/libraryApi";

interface LibraryStore {
  videos: LibraryVideo[];

  page: number;
  size: number;
  totalElements: number;
  totalPages: number;

  isLoading: boolean;
  isMutating: boolean;
  error: ApiError | null;

  loadLibrary: (query?: LibraryQuery) => Promise<void>;

  addVideo: (youtubeUrl: string) => Promise<LibraryVideo>;

  ensureVideo: (
    libraryVideoId: number,
  ) => Promise<LibraryVideo>;

  updateVideo: (
    libraryVideoId: number,
    input: UpdateLibraryVideoInput,
  ) => Promise<LibraryVideo>;

  getDeleteImpact: (
    libraryVideoId: number,
  ) => Promise<LibraryVideoDeleteImpact>;

  deleteVideo: (libraryVideoId: number) => Promise<void>;

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
  videos: [] as LibraryVideo[],

  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,

  isLoading: false,
  isMutating: false,

  error: null as ApiError | null,
};

export const useLibraryStore = create<LibraryStore>((set, get) => ({
  ...initialState,

  loadLibrary: async (query = {}) => {
    set({
      isLoading: true,
      error: null,
    });

    try {
      const response = await getLibrary({
        page: 0,
        size: 20,
        sortBy: "addedAt",
        sortDirection: "desc",
        ...query,
      });

      set({
        videos: response.items,
        page: response.page,
        size: response.size,
        totalElements: response.totalElements,
        totalPages: response.totalPages,
      });
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

  addVideo: async (youtubeUrl) => {
    set({
      isMutating: true,
      error: null,
    });

    try {
      const video = await addLibraryVideo({
        youtubeUrl,
      });

      set((state) => ({
        videos: [
          video,
          ...state.videos.filter(
            (existing) => existing.id !== video.id,
          ),
        ],
        totalElements: state.totalElements + 1,
      }));

      return video;
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

  updateVideo: async (libraryVideoId, input) => {
    set({
      isMutating: true,
      error: null,
    });

    try {
      const updatedVideo = await updateLibraryVideo(
        libraryVideoId,
        input,
      );

      set((state) => ({
        videos: state.videos.map((video) =>
          video.id === libraryVideoId
            ? updatedVideo
            : video,
        ),
      }));

      return updatedVideo;
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

  getDeleteImpact: async (libraryVideoId) => {
    set({
      error: null,
    });

    try {
      return await getLibraryVideoDeleteImpact(
        libraryVideoId,
      );
    } catch (error) {
      const apiError = toApiError(error);

      set({
        error: apiError,
      });

      throw apiError;
    }
  },

  deleteVideo: async (libraryVideoId) => {
    set({
      isMutating: true,
      error: null,
    });

    try {
      await deleteLibraryVideo(libraryVideoId);

      set((state) => ({
        videos: state.videos.filter(
          (video) => video.id !== libraryVideoId,
        ),
        totalElements: Math.max(
          0,
          state.totalElements - 1,
        ),
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

  ensureVideo: async (
    libraryVideoId,
  ) => {
    const existing =
      get().videos.find(
        (video) =>
          video.id ===
          libraryVideoId,
      );

    if (existing) {
      return existing;
    }

    try {
      const video =
        await getLibraryVideo(
          libraryVideoId,
        );

      set((state) => ({
        videos: [
          video,
          ...state.videos.filter(
            (existingVideo) =>
              existingVideo.id !==
              video.id,
          ),
        ],
        error: null,
      }));

      return video;
    } catch (error) {
      const apiError =
        toApiError(error);

      set({
        error: apiError,
      });

      throw apiError;
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
}));