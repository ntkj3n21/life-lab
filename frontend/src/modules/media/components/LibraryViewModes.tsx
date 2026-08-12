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
  description: string;
}> = [
  {
    value: "all",
    label: "All Videos",
    description:
      "Browse the full Library using your selected filters and sort order.",
  },
  {
    value: "recent",
    label: "Recently Watched",
    description:
      "Only watched Videos, ordered by the most recent valid WatchSession.",
  },
  {
    value: "most",
    label: "Most Watched",
    description:
      "Only watched Videos, ordered by your valid personal view count.",
  },
];

export function LibraryViewModes({
  mode,
  isLoading,
  onChange,
}: LibraryViewModesProps) {
  const activeMode =
    modes.find(
      (item) =>
        item.value === mode,
    ) ?? modes[0];

  return (
    <section
      aria-label="Library view"
      className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-3"
    >
      <div
        role="group"
        aria-label="Library view mode"
        className="grid gap-2 sm:grid-cols-3"
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
              className={`rounded-xl border px-3 py-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600 disabled:cursor-not-allowed ${
                isActive
                  ? "border-neutral-600 bg-neutral-800 text-white"
                  : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200 disabled:opacity-70"
              }`}
            >
              <span className="block text-sm font-medium">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      <p
        aria-live="polite"
        className="mt-2 text-xs leading-5 text-neutral-500"
      >
        {activeMode.description}
      </p>
    </section>
  );
}