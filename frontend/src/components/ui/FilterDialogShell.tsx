import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface FilterDialogShellProps {
  open: boolean;
  dialogId: string;
  title: string;
  description: string;
  isBusy: boolean;
  onDismiss: () => void;
  children: ReactNode;
  footer: ReactNode;
  closeAriaLabel?: string;
  maxWidthClassName?: string;
}

export function FilterDialogShell({
  open,
  dialogId,
  title,
  description,
  isBusy,
  onDismiss,
  children,
  footer,
  closeAriaLabel = `Close ${title}`,
  maxWidthClassName = "max-w-4xl",
}: FilterDialogShellProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const dismissRef = useRef(onDismiss);
  const isBusyRef = useRef(isBusy);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    dismissRef.current = onDismiss;
    isBusyRef.current = isBusy;
  }, [isBusy, onDismiss]);

  useEffect(() => {
    if (!open) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusyRef.current) {
        event.preventDefault();
        dismissRef.current();
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
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (
        !(document.activeElement instanceof Node) ||
        !dialog.contains(document.activeElement)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", handleKeyDown);

      const previousFocus = previousFocusRef.current;

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
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-(--overlay-backdrop) p-3 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) {
          onDismiss();
        }
      }}
    >
      <div
        id={dialogId}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isBusy}
        tabIndex={-1}
        className={`flex max-h-[calc(100dvh-1.5rem)] w-full ${maxWidthClassName} flex-col overflow-hidden rounded-2xl border border-(--border) bg-(--panel-bg) shadow-(--elevated-shadow) sm:max-h-[calc(100dvh-2rem)]`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-(--border) px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base font-semibold text-(--text-primary)"
            >
              {title}
            </h2>

            <p
              id={descriptionId}
              className="mt-1 text-xs leading-5 text-(--text-muted)"
            >
              {description}
            </p>
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onDismiss}
            disabled={isBusy}
            aria-label={closeAriaLabel}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-(--text-muted) transition hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:w-9"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {children}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-(--border) bg-(--panel-bg) px-4 py-3 sm:px-5">
          {footer}
        </div>
      </div>
    </div>
  );
}
