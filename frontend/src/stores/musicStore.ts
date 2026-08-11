import { create } from "zustand";
import { nanoid } from "nanoid";

import type { MusicTrack } from "../types/lifeLab";

const MUSIC_STORAGE_KEY = "life-lab-music";

interface CreateMusicTrackInput {
  title: string;
  artist?: string;
  url: string;
  tags?: string[];
}

interface MusicStore {
  tracks: MusicTrack[];
  activeTrackId: string | null;
  isPlaying: boolean;

  addTrack: (input: CreateMusicTrackInput) => MusicTrack;
  deleteTrack: (trackId: string) => void;
  setActiveTrack: (trackId: string) => void;
  play: () => void;
  pause: () => void;
  togglePlayback: () => void;
  playNext: () => void;
  playPrevious: () => void;
}

function loadTracksFromStorage(): MusicTrack[] {
  try {
    const rawTracks = localStorage.getItem(MUSIC_STORAGE_KEY);

    if (!rawTracks) {
      return [];
    }

    return JSON.parse(rawTracks) as MusicTrack[];
  } catch (error) {
    console.error("Failed to load music tracks from localStorage:", error);
    return [];
  }
}

function saveTracksToStorage(tracks: MusicTrack[]) {
  try {
    localStorage.setItem(MUSIC_STORAGE_KEY, JSON.stringify(tracks));
  } catch (error) {
    console.error("Failed to save music tracks to localStorage:", error);
  }
}

function getAdjacentTrackId(
  tracks: MusicTrack[],
  activeTrackId: string | null,
  direction: "next" | "previous",
) {
  if (tracks.length === 0) {
    return null;
  }

  if (!activeTrackId) {
    return tracks[0].id;
  }

  const activeIndex = tracks.findIndex((track) => track.id === activeTrackId);

  if (activeIndex === -1) {
    return tracks[0].id;
  }

  const offset = direction === "next" ? 1 : -1;
  const nextIndex = (activeIndex + offset + tracks.length) % tracks.length;

  return tracks[nextIndex].id;
}

export const useMusicStore = create<MusicStore>((set) => ({
  tracks: loadTracksFromStorage(),
  activeTrackId: null,
  isPlaying: false,

  addTrack: (input) => {
    const now = Date.now();

    const newTrack: MusicTrack = {
      id: nanoid(),
      type: "music",
      title: input.title.trim(),
      artist: input.artist?.trim() || undefined,
      url: input.url.trim(),
      tags: input.tags ?? [],
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const nextTracks = [newTrack, ...state.tracks];
      saveTracksToStorage(nextTracks);

      return {
        tracks: nextTracks,
        activeTrackId: state.activeTrackId ?? newTrack.id,
      };
    });

    return newTrack;
  },

  deleteTrack: (trackId) => {
    set((state) => {
      const nextTracks = state.tracks.filter((track) => track.id !== trackId);
      const isDeletingActiveTrack = state.activeTrackId === trackId;

      saveTracksToStorage(nextTracks);

      return {
        tracks: nextTracks,
        activeTrackId: isDeletingActiveTrack
          ? (nextTracks[0]?.id ?? null)
          : state.activeTrackId,
        isPlaying: nextTracks.length > 0 && !isDeletingActiveTrack
          ? state.isPlaying
          : false,
      };
    });
  },

  setActiveTrack: (trackId) => {
    set({
      activeTrackId: trackId,
    });
  },

  play: () => {
    set((state) => ({
      isPlaying: state.tracks.length > 0,
      activeTrackId: state.activeTrackId ?? state.tracks[0]?.id ?? null,
    }));
  },

  pause: () => {
    set({
      isPlaying: false,
    });
  },

  togglePlayback: () => {
    set((state) => ({
      isPlaying: state.tracks.length > 0 ? !state.isPlaying : false,
      activeTrackId: state.activeTrackId ?? state.tracks[0]?.id ?? null,
    }));
  },

  playNext: () => {
    set((state) => ({
      activeTrackId: getAdjacentTrackId(
        state.tracks,
        state.activeTrackId,
        "next",
      ),
      isPlaying: state.tracks.length > 0,
    }));
  },

  playPrevious: () => {
    set((state) => ({
      activeTrackId: getAdjacentTrackId(
        state.tracks,
        state.activeTrackId,
        "previous",
      ),
      isPlaying: state.tracks.length > 0,
    }));
  },
}));
