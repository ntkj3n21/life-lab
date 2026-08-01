import {
  Calendar,
  CheckSquare,
  Film,
  Home,
  Music,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
} from "lucide-react";

import { useLayoutStore } from "../../stores/layoutStore";

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
  const isSidebarCollapsed = useLayoutStore(
    (state) => state.isSidebarCollapsed,
  );
  const toggleSidebar = useLayoutStore((state) => state.toggleSidebar);
  const openRightPanel = useLayoutStore((state) => state.openRightPanel);

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 transition-all ${
        isSidebarCollapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex items-center justify-between border-b border-neutral-800 p-4">
        {!isSidebarCollapsed && (
          <div>
            <h1 className="font-semibold">Life Lab</h1>
            <p className="text-xs text-neutral-500">Personal workspace</p>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white"
          title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen size={16} />
          ) : (
            <PanelLeftClose size={16} />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.label}
              onClick={() => {
                if (item.label === "Music") {
                  openRightPanel("player");
                }
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-neutral-300 transition hover:bg-neutral-800 hover:text-white ${
                isSidebarCollapsed ? "justify-center" : ""
              }`}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <Icon size={18} className="shrink-0" />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
