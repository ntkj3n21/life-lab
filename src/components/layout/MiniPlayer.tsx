export function MiniPlayer() {
  return (
    <footer className="flex h-20 shrink-0 items-center justify-between border-t border-neutral-800 bg-neutral-900 px-6">
      <div>
        <p className="text-sm font-medium">Mini Player</p>
        <p className="text-xs text-neutral-400">
          Chưa có bài hát nào đang phát.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button className="rounded-full border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800">
          Prev
        </button>
        <button className="rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200">
          Play
        </button>
        <button className="rounded-full border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800">
          Next
        </button>
      </div>
    </footer>
  );
}