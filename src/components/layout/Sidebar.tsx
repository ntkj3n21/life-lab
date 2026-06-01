import {
  Calendar,
  CheckSquare,
  Film,
  Home,
  Music,
  NotebookPen,
  Settings,
} from "lucide-react";

const navItems = [
  { label: "Home", icon: Home },
  { label: "Media", icon: Film },
  { label: "Music", icon: Music },
  { label: "Notes", icon: NotebookPen },
  { label: "Todo", icon: CheckSquare },
  { label: "Calendar", icon: Calendar },
  { label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-800 bg-neutral-900/80">
      <div className="border-b border-neutral-800 p-5">
        <h1 className="text-xl font-bold tracking-tight">Life Lab</h1>
        <p className="mt-1 text-sm text-neutral-400">Personal workspace</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}