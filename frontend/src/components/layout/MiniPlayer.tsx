import { useMemo, useState } from "react";
import {
  Music2,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";

import { useMusicStore } from "../../stores/musicStore";

export function MiniPlayer() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [url, setUrl] = useState("");
  const tracks = useMusicStore((state) => state.tracks);
  const activeTrackId = useMusicStore((state) => state.activeTrackId);
  const isPlaying = useMusicStore((state) => state.isPlaying);
  const addTrack = useMusicStore((state) => state.addTrack);
  const deleteTrack = useMusicStore((state) => state.deleteTrack);
  const setActiveTrack = useMusicStore((state) => state.setActiveTrack);
  const togglePlayback = useMusicStore((state) => state.togglePlayback);
  const play = useMusicStore((state) => state.play);
  const playNext = useMusicStore((state) => state.playNext);
  const playPrevious = useMusicStore((state) => state.playPrevious);

  const activeTrack = useMemo(
    () => tracks.find((track) => track.id === activeTrackId) ?? null,
    [activeTrackId, tracks],
  );

  function handleAddTrack(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle || !trimmedUrl) return;

    addTrack({
      title: trimmedTitle,
      artist,
      url: trimmedUrl,
    });

    setTitle("");
    setArtist("");
    setUrl("");
  }

  function handleSelectTrack(trackId: string) {
    setActiveTrack(trackId);
    play();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300">
            <Music2 size={18} />
          </div>

          <div className="min-w-0">
            <h4 className="truncate font-medium">
              {activeTrack?.title ?? "No track playing"}
            </h4>
            <p className="mt-1 truncate text-sm text-neutral-500">
              {activeTrack?.artist ?? "Add a direct audio URL to start."}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
          <p className="text-sm text-neutral-500">Current track</p>
          <p className="mt-1 truncate text-neutral-300">
            {activeTrack
              ? activeTrack.artist
                ? `${activeTrack.title} - ${activeTrack.artist}`
                : activeTrack.title
              : "Nothing is playing yet."}
          </p>
        </div>

        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            onClick={playPrevious}
            disabled={tracks.length === 0}
            className="rounded-xl border border-neutral-800 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:text-neutral-700"
            title="Previous track"
          >
            <SkipBack size={18} />
          </button>

          <button
            onClick={togglePlayback}
            disabled={tracks.length === 0}
            className="rounded-full bg-white p-3 text-neutral-950 hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-800 disabled:text-neutral-500"
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          </button>

          <button
            onClick={playNext}
            disabled={tracks.length === 0}
            className="rounded-xl border border-neutral-800 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:text-neutral-700"
            title="Next track"
          >
            <SkipForward size={18} />
          </button>
        </div>
      </div>

      <form
        onSubmit={handleAddTrack}
        className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4"
      >
        <h4 className="font-medium">Add Track</h4>
        <p className="mt-1 text-xs text-neutral-500">
          Use a direct audio file URL, such as mp3, wav, or ogg.
        </p>

        <div className="mt-4 space-y-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
            placeholder="Track title"
          />

          <input
            value={artist}
            onChange={(event) => setArtist(event.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
            placeholder="Artist"
          />

          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
            placeholder="Audio URL"
          />
        </div>

        <button
          type="submit"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          <Plus size={16} />
          Add Track
        </button>
      </form>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
        <div className="flex items-center justify-between gap-3">
          <h4 className="font-medium">Music Library</h4>
          <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-400">
            {tracks.length}
          </span>
        </div>

        {tracks.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-500">
            No tracks yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {tracks.map((track) => (
              <div
                key={track.id}
                className={`flex items-center gap-2 rounded-xl border p-2 ${
                  track.id === activeTrackId
                    ? "border-neutral-700 bg-neutral-800"
                    : "border-neutral-800 bg-neutral-950"
                }`}
              >
                <button
                  onClick={() => handleSelectTrack(track.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-sm font-medium text-neutral-200">
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {track.artist ?? "Unknown artist"}
                  </p>
                </button>

                <button
                  onClick={() => deleteTrack(track.id)}
                  className="rounded-lg border border-neutral-800 p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-white"
                  title="Delete track"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
