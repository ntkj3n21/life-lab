import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;

  title: string;
  description?: string;
  details?: readonly string[];

  confirmLabel?: string;
  cancelLabel?: string;

  isBusy?: boolean;
  errorMessage?: string | null;

  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  details = [],
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isBusy = false,
  errorMessage,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !isBusy
      ) {
        onCancel();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    open,
    isBusy,
    onCancel,
  ]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={
          description
            ? "confirm-dialog-description"
            : undefined
        }
        aria-busy={isBusy}
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-2xl"
      >
        <h2
          id="confirm-dialog-title"
          className="wrap-break-word text-lg font-semibold text-neutral-100"
        >
          {title}
        </h2>

        {description && (
          <p
            id="confirm-dialog-description"
            className="mt-2 wrap-break-word text-sm leading-6 text-neutral-400"
          >
            {description}
          </p>
        )}

        {details.length > 0 && (
          <ul className="mt-4 space-y-2 rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-xs leading-5 text-neutral-400">
            {details.map((detail) => (
              <li
                key={detail}
                className="flex min-w-0 gap-2"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-neutral-600"
                >
                  •
                </span>

                <span className="min-w-0 wrap-break-word">
                  {detail}
                </span>
              </li>
            ))}
          </ul>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="mt-3 wrap-break-word rounded-xl border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300"
          >
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            autoFocus
            disabled={isBusy}
            onClick={onCancel}
            className="rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              void onConfirm()
            }
            className="rounded-xl bg-red-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBusy
              ? "Working..."
              : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}