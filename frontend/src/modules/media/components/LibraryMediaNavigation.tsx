import { Link, useLocation } from "react-router-dom";

const mediaItems = [
  {
    label: "Videos",
    to: "/library",
  },
  {
    label: "Images",
    to: "/images",
  },
  {
    label: "Audio",
    to: "/audio",
  },
] as const;

interface LibraryMediaNavigationProps {
  className?: string;
}

export function LibraryMediaNavigation({
  className,
}: LibraryMediaNavigationProps) {
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Library media"
      className={`flex max-w-full overflow-x-auto ${className ?? ""}`}
    >
      <div className="inline-flex min-w-max items-center gap-1 rounded-xl border border-(--border) bg-(--app-bg) p-1">
        {mediaItems.map((item) => {
          const isActive =
            pathname === item.to ||
            pathname.startsWith(`${item.to}/`);
          const classNames = `rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${
            isActive
              ? "bg-(--surface-hover) font-medium text-(--text-primary) shadow-sm"
              : "text-(--text-muted) hover:bg-(--surface) hover:text-(--text-primary)"
          }`;

          return isActive ? (
            <span
              key={item.to}
              aria-current="page"
              className={classNames}
            >
              {item.label}
            </span>
          ) : (
            <Link
              key={item.to}
              to={item.to}
              className={classNames}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
