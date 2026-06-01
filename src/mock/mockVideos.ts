import type { VideoItem } from "../types/lifeLab";

const now = Date.now();

export const mockVideos: VideoItem[] = [
  {
    id: "video-001",
    type: "video",
    title: "Demo Learning Video",
    sourceType: "embed",
    url: "https://embed12.streamc.xyz/embed.php?hash=aac31df41dd4015ebc3268dd2e729ff1",
    tags: ["learning", "demo"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "video-002",
    type: "video",
    title: "React Study Session",
    sourceType: "embed",
    url: "https://example.com/embed/react-study-session",
    tags: ["react", "frontend", "study"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "video-003",
    type: "video",
    title: "Productivity Workflow",
    sourceType: "embed",
    url: "https://example.com/embed/productivity-workflow",
    tags: ["productivity", "workflow"],
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "video-004",
    type: "video",
    title: "Music Focus Background",
    sourceType: "embed",
    url: "https://example.com/embed/music-focus-background",
    tags: ["music", "focus"],
    createdAt: now,
    updatedAt: now,
  },
];