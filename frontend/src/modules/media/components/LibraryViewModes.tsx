export type LibraryViewMode =
  | "all"
  | "recent"
  | "most";

interface LibraryViewModesProps {
  mode: LibraryViewMode;
  isLoading: boolean;

  onChange: (
    mode: LibraryViewMode,
  ) => Promise<void>;
}

const modes: Array<{
  value: LibraryViewMode;
  label: string;
}> = [
  {
    value: "all",
    label: "All",
  },
  {
    value: "recent",
    label: "Recently watched",
  },
  {
    value: "most",
    label: "Most watched",
  },
];

export function LibraryViewModes({
  mode,
  isLoading,
  onChange,
}: LibraryViewModesProps) {
  return (
    <div
      aria-label="Library view"
      className="mt-4"
    >
      <div
        role="group"
        aria-label="Library view mode"
        className="inline-flex max-w-full items-center gap-0.5 rounded-lg border border-(--border) bg-(--app-bg) p-1"
      >
        {modes.map((item) => {
          const isActive =
            item.value === mode;

          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={isActive}
              disabled={
                isLoading ||
                isActive
              }
              onClick={() =>
                void onChange(
                  item.value,
                )
              }
              className={`rounded-md px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed ${
                isActive
                  ? "bg-(--surface-active) text-(--text-primary)"
                  : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary) disabled:opacity-70"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
