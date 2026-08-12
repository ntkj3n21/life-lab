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
    label: "Daily Plan",
    icon: CalendarDays,
  },
] as const;

export function MobileNavigation() {
  return (
    <nav
      aria-label="Primary navigation"
      className="flex shrink-0 gap-1 overflow-x-auto border-b border-neutral-800 bg-neutral-950 px-3 py-2 xl:hidden"
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
              `flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 ${
                isActive
                  ? "bg-neutral-800 text-white"
                  : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-200"
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