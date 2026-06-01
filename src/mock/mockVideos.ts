import type { VideoItem } from "../types/lifeLab";

export const mockVideos: VideoItem[] = [
  {
    id: "video-001",
    type: "video",
    title: "Demo Learning Video",
    sourceType: "embed",
    url: "https://example.com/embed/demo",
    tags: ["learning", "demo"],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];