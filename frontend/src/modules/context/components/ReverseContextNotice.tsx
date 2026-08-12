import {
  CircleAlert,
  Info,
  X,
} from "lucide-react";

import { useReverseContextStore } from "../../../stores/reverseContextStore";

export function ReverseContextNotice() {
  const notice =
    useReverseContextStore(
      (state) => state.notice,
    );

  const clearNotice =
    useReverseContextStore(
      (state) =>
        state.clearNotice,
    );

  if (!notice) {
    return null;
  }

  const isWarning =
    notice.tone === "warning";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-neutral-700 bg-neutral-950 p-4 shadow-2xl"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            isWarning
              ? "bg-amber-950/60 text-amber-300"
              : "bg-neutral-800 text-neutral-300"
          }`}
        >
          {isWarning ? (
            <CircleAlert
              size={17}
              aria-hidden="true"
            />
          ) : (
            <Info
              size={17}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-100">
            {notice.title}
          </p>

          <p className="mt-1 text-xs leading-5 text-neutral-400">
            {notice.message}
          </p>
        </div>

        <button
          type="button"
          onClick={clearNotice}
          aria-label="Dismiss context notice"
          className="shrink-0 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600"
        >
          <X
            size={15}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}