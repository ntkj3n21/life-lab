import {
  useEffect,
  useId,
  useRef,
} from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

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
  const dialogRef =
    useRef<HTMLDivElement | null>(null);
  const cancelButtonRef =
    useRef<HTMLButtonElement | null>(null);
  const previousFocusRef =
    useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const isBusyRef = useRef(isBusy);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    onCancelRef.current = onCancel;
    isBusyRef.current = isBusy;
  }, [
    onCancel,
    isBusy,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusFrame =
      window.requestAnimationFrame(() => {
        cancelButtonRef.current?.focus();
      });

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (
        event.key === "Escape" &&
        !isBusyRef.current
      ) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const dialog = dialogRef.current;

      if (!dialog) {
        return;
      }

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR,
        ),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last =
        focusable[focusable.length - 1];

      if (
        !(document.activeElement instanceof Node) ||
        !dialog.contains(document.activeElement)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      window.cancelAnimationFrame(
        focusFrame,
      );
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );

      const previousFocus =
        previousFocusRef.current;

      if (previousFocus?.isConnected) {
        previousFocus.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-backdrop) p-4"
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={
          description
            ? descriptionId
            : undefined
        }
        aria-busy={isBusy}
        tabIndex={-1}
        className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-(--border) bg-(--surface) p-5 shadow-[var(--elevated-shadow)]"
      >
        <h2
          id={titleId}
          className="wrap-break-word text-lg font-semibold text-(--text-primary)"
        >
          {title}
        </h2>

        {description && (
          <p
            id={descriptionId}
            className="mt-2 wrap-break-word text-sm leading-6 text-(--text-secondary)"
          >
            {description}
          </p>
        )}

        {details.length > 0 && (
          <ul className="mt-4 space-y-2 rounded-xl border border-(--border) bg-(--surface) p-3 text-xs leading-5 text-(--text-secondary)">
            {details.map((detail) => (
              <li
                key={detail}
                className="flex min-w-0 gap-2"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-(--text-faint)"
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
            className="mt-3 wrap-break-word rounded-xl border border-(--danger-border) bg-(--danger-surface) px-3 py-2 text-xs text-(--danger-text)"
          >
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            ref={cancelButtonRef}
            type="button"
            disabled={isBusy}
            onClick={onCancel}
            className="rounded-xl border border-(--border) px-4 py-2 text-sm text-(--text-secondary) transition hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() =>
              void onConfirm()
            }
            className="rounded-xl bg-(--danger-solid-bg) px-4 py-2 text-sm font-medium text-(--danger-solid-text) transition hover:bg-(--danger-solid-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--danger-ring) disabled:cursor-not-allowed disabled:opacity-50"
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
