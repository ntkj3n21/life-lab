import { QuickNotePanel } from "../../modules/notes/components/QuickNotePanel";

export function RightDock() {
  return (
    <aside className="no-scrollbar w-[340px] shrink-0 overflow-y-auto border-l border-neutral-800 bg-neutral-900/70 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Right Dock</h3>
        <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs text-neutral-400">
          Notes
        </span>
      </div>

      <QuickNotePanel />
    </aside>
  );
}