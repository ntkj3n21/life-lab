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
      className="fixed bottom-4 right-4 z-40 w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-(--border-strong) bg-(--surface) p-4 shadow-(--elevated-shadow)"
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
            isWarning
              ? "bg-(--warning-surface) text-(--warning-text)"
              : "bg-(--surface-hover) text-(--text-secondary)"
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
          <p className="text-sm font-medium text-(--text-primary)">
            {notice.title}
          </p>

          <p className="mt-1 text-xs leading-5 text-(--text-secondary)">
            {notice.message}
          </p>
        </div>

        <button
          type="button"
          onClick={clearNotice}
          aria-label="Dismiss context notice"
          className="shrink-0 rounded-lg p-1.5 text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
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
