import {
  CalendarDays,
  Library,
  ListTodo,
  PanelLeftClose,
  PanelLeftOpen,
  StickyNote,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useLayoutStore } from "../../stores/layoutStore";

const navItems = [
  {
    to: "/library",
    label: "Library",
    icon: Library,
  },
  {
    to: "/notes",
    label: "Notes",
    icon: StickyNote,
  },
  {
    to: "/tasks",
    label: "Tasks",
    icon: ListTodo,
  },
  {
    to: "/plan",
    label: "Daily Plan",
    icon: CalendarDays,
  },
] as const;

export function Sidebar() {
  const isSidebarCollapsed =
    useLayoutStore(
      (state) =>
        state.isSidebarCollapsed,
    );

  const toggleSidebar =
    useLayoutStore(
      (state) =>
        state.toggleSidebar,
    );

  return (
    <aside
      aria-label="Primary navigation"
      className={`hidden shrink-0 flex-col border-r border-neutral-800 bg-neutral-950 transition-all xl:flex ${
        isSidebarCollapsed
          ? "w-16"
          : "w-64"
      }`}
    >
      <div className="flex items-center justify-between border-b border-neutral-800 p-4">
        {!isSidebarCollapsed && (
          <div>
            <h1 className="font-semibold">
              Life Lab
            </h1>

            <p className="text-xs text-neutral-500">
              Personal workspace
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={
            isSidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
          className="rounded-lg border border-neutral-800 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
          title={
            isSidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen
              size={16}
            />
          ) : (
            <PanelLeftClose
              size={16}
            />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map(
          ({
            to,
            label,
            icon: Icon,
          }) => (
            <NavLink
              key={to}
              to={to}
              className={({
                isActive,
              }) =>
                `flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 ${
                  isActive
                    ? "bg-neutral-800 text-white"
                    : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-100"
                } ${
                  isSidebarCollapsed
                    ? "justify-center"
                    : ""
                }`
              }
              title={
                isSidebarCollapsed
                  ? label
                  : undefined
              }
            >
              <Icon
                size={18}
                className="shrink-0"
                aria-hidden="true"
              />

              {!isSidebarCollapsed && (
                <span>
                  {label}
                </span>
              )}
            </NavLink>
          ),
        )}
      </nav>
    </aside>
  );
}