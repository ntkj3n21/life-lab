import { useEffect, useMemo, useRef } from "react";

import { useMusicStore } from "../../stores/musicStore";

export function MusicAudioEngine() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracks = useMusicStore((state) => state.tracks);
  const activeTrackId = useMusicStore((state) => state.activeTrackId);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const pause = useMusicStore((state) => state.pause);
  const playNext = useMusicStore((state) => state.playNext);

  const activeTrack = useMemo(
    () => tracks.find((track) => track.id === activeTrackId) ?? null,
    [activeTrackId, tracks],
  );

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) return;

    if (!activeTrack || !isPlaying) {
      audio.pause();
      return;
    }

    audio.play().catch((error) => {
      console.error("Failed to play audio track:", error);
      pause();
    });
  }, [activeTrack, isPlaying, pause]);

  return (
    <audio
      ref={audioRef}
      src={activeTrack?.url}
      onEnded={playNext}
      onPause={() => {
        if (isPlaying) {
          pause();
        }
      }}
    />
  );
}
