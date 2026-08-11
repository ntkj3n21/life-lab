export function Topbar() {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-800 px-6">
      <div>
        <h2 className="text-lg font-semibold">Media Workspace</h2>
        <p className="text-sm text-neutral-400">
          Xem video, nghe nhạc, ghi chú mà không rời context.
        </p>
      </div>

      <button className="rounded-xl border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-800">
        Ctrl + K
      </button>
    </header>
  );
}