import { ChevronLeft, ChevronRight } from "lucide-react";

interface LibraryPaginationProps {
  page: number;
  totalPages: number;
  isLoading: boolean;

  onChangePage: (nextPage: number) => Promise<void>;
}

export function LibraryPagination({
  page,
  totalPages,
  isLoading,
  onChangePage,
}: LibraryPaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-5 flex items-center justify-between border-t border-(--border) pt-4">
      <p className="text-xs text-(--text-muted)">
        Page {page + 1} of {totalPages}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void onChangePage(page - 1)}
          disabled={page === 0 || isLoading}
          className="flex min-h-10 items-center gap-1 rounded-lg border border-(--border) px-3 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:py-1.5"
        >
          <ChevronLeft size={14} aria-hidden="true" />
          Previous
        </button>

        <button
          type="button"
          onClick={() => void onChangePage(page + 1)}
          disabled={page + 1 >= totalPages || isLoading}
          className="flex min-h-10 items-center gap-1 rounded-lg border border-(--border) px-3 text-xs text-(--text-secondary) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:py-1.5"
        >
          Next
          <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
