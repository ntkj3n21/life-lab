import {
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface LibraryPaginationProps {
  page: number;
  totalPages: number;
  isLoading: boolean;

  onChangePage: (
    nextPage: number,
  ) => Promise<void>;
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
    <div className="mt-5 flex items-center justify-between border-t border-neutral-800 pt-4">
      <p className="text-xs text-neutral-500">
        Page {page + 1} of {totalPages}
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            void onChangePage(
              page - 1,
            )
          }
          disabled={
            page === 0 ||
            isLoading
          }
          className="flex items-center gap-1 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={14} />
          Previous
        </button>

        <button
          type="button"
          onClick={() =>
            void onChangePage(
              page + 1,
            )
          }
          disabled={
            page + 1 >= totalPages ||
            isLoading
          }
          className="flex items-center gap-1 rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}