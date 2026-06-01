import { create } from "zustand";
import { nanoid } from "nanoid";
import type { VideoItem } from "../types/lifeLab";

const VIDEOS_STORAGE_KEY = "life-lab-videos";

interface CreateVideoInput {
  title: string;
  url: string;
  tags?: string[];
}

interface VideoStore {
  videos: VideoItem[];
  addVideo: (input: CreateVideoInput) => void;
  deleteVideo: (videoId: string) => void;
  clearVideos: () => void;
}

const defaultVideos: VideoItem[] = [
  {
    id: "video-001",
    type: "video",
    title: "Demo Learning Video",
    sourceType: "embed",
    url: "https://example.com/embed/demo-learning-video",
    tags: ["learning", "demo"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: "video-002",
    type: "video",
    title: "React Study Session",
    sourceType: "embed",
    url: "https://example.com/embed/react-study-session",
    tags: ["react", "frontend", "study"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

function loadVideosFromStorage(): VideoItem[] {
  try {
    const rawVideos = localStorage.getItem(VIDEOS_STORAGE_KEY);

    if (!rawVideos) {
      return defaultVideos;
    }

    return JSON.parse(rawVideos) as VideoItem[];
  } catch (error) {
    console.error("Failed to load videos from localStorage:", error);
    return defaultVideos;
  }
}

function saveVideosToStorage(videos: VideoItem[]) {
  try {
    localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(videos));
  } catch (error) {
    console.error("Failed to save videos to localStorage:", error);
  }
}

export const useVideoStore = create<VideoStore>((set) => ({
  videos: loadVideosFromStorage(),

  addVideo: (input) => {
    const now = Date.now();

    const newVideo: VideoItem = {
      id: nanoid(),
      type: "video",
      title: input.title,
      sourceType: "embed",
      url: input.url,
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const nextVideos = [newVideo, ...state.videos];
      saveVideosToStorage(nextVideos);

      return {
        videos: nextVideos,
      };
    });
  },

  deleteVideo: (videoId) => {
    set((state) => {
      const nextVideos = state.videos.filter((video) => video.id !== videoId);
      saveVideosToStorage(nextVideos);

      return {
        videos: nextVideos,
      };
    });
  },

  clearVideos: () => {
    saveVideosToStorage([]);
    set({ videos: [] });
  },
}));