import { Play, SkipBack, SkipForward } from "lucide-react";

export function MiniPlayer() {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
      <div>
        <h4 className="font-medium">No track playing</h4>
        <p className="mt-1 text-sm text-neutral-500">
          Music module will be added later.
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950 p-4">
        <p className="text-sm text-neutral-500">Current track</p>
        <p className="mt-1 text-neutral-300">Nothing is playing yet.</p>
      </div>

      <div className="mt-5 flex items-center justify-center gap-3">
        <button className="rounded-xl border border-neutral-800 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white">
          <SkipBack size={18} />
        </button>

        <button className="rounded-full bg-white p-3 text-neutral-950 hover:bg-neutral-200">
          <Play size={18} />
        </button>

        <button className="rounded-xl border border-neutral-800 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white">
          <SkipForward size={18} />
        </button>
      </div>
    </div>
  );
}
