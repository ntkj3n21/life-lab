import {
  CalendarDays,
  Library,
  ListTodo,
  StickyNote,
} from "lucide-react";
import { NavLink } from "react-router-dom";

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
    label: "Plan",
    icon: CalendarDays,
  },
] as const;

export function MobileNavigation() {
  return (
    <nav
      aria-label="Primary navigation"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-(--border) bg-(--panel-bg) px-2 py-1.5 xl:hidden"
    >
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
              `flex h-10 shrink-0 items-center gap-2 rounded-[9px] px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${
                isActive
                  ? "bg-(--surface-hover) font-medium text-(--text-primary)"
                  : "text-(--text-muted) hover:bg-(--surface) hover:text-(--text-primary)"
              }`
            }
          >
            <Icon
              size={15}
              aria-hidden="true"
            />

            <span>{label}</span>
          </NavLink>
        ),
      )}
    </nav>
  );
}
