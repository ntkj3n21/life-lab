import {
  ChevronLeft,
  PanelRight,
  X,
} from "lucide-react";
import {
  type MouseEvent,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";

import { useLayoutStore } from "../../stores/layoutStore";
import { RightDock } from "./RightDock";

const DRAWER_MEDIA_QUERY =
  "(max-width: 1279px)";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function subscribeToDrawerViewport(
  onStoreChange: () => void,
) {
  const mediaQuery = window.matchMedia(
    DRAWER_MEDIA_QUERY,
  );

  mediaQuery.addEventListener(
    "change",
    onStoreChange,
  );

  return () => {
    mediaQuery.removeEventListener(
      "change",
      onStoreChange,
    );
  };
}

function isDrawerViewport() {
  return window.matchMedia(
    DRAWER_MEDIA_QUERY,
  ).matches;
}

export function RightPanel() {
  const drawerRef =
    useRef<HTMLElement | null>(null);
  const closeButtonRef =
    useRef<HTMLButtonElement | null>(null);
  const workspaceTitleId = useId();
  const isDrawer = useSyncExternalStore(
    subscribeToDrawerViewport,
    isDrawerViewport,
    () => false,
  );

  const activeRightPanel =
    useLayoutStore(
      (state) =>
        state.activeRightPanel,
    );

  const openRightPanel =
    useLayoutStore(
      (state) =>
        state.openRightPanel,
    );

  const closeRightPanel =
    useLayoutStore(
      (state) =>
        state.closeRightPanel,
    );

  const isOpen =
    activeRightPanel === "tools";

  function handleOpen(
    event: MouseEvent<HTMLButtonElement>,
  ) {
    event.currentTarget.blur();
    openRightPanel("tools");
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const focusFrame =
      window.requestAnimationFrame(() => {
        closeButtonRef.current?.focus();
      });

    return () => {
      window.cancelAnimationFrame(
        focusFrame,
      );

      window.requestAnimationFrame(() => {
        const source = isDrawerViewport()
          ? "mobile"
          : "desktop";
        const trigger = source
          ? document.querySelector<HTMLButtonElement>(
              `[data-workspace-trigger="${source}"]`,
            )
          : null;

        trigger?.focus();
      });
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isDrawer) {
      return;
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeRightPanel();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const drawer = drawerRef.current;

      if (!drawer) {
        return;
      }

      const focusable = Array.from(
        drawer.querySelectorAll<HTMLElement>(
          FOCUSABLE_SELECTOR,
        ),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }

      const first = focusable[0];
      const last =
        focusable[focusable.length - 1];

      if (
        !(document.activeElement instanceof Node) ||
        !drawer.contains(document.activeElement)
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
      window.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [
    isOpen,
    isDrawer,
    closeRightPanel,
  ]);

  /*
   * Closed Workspace
   *
   * Desktop:
   * keep a slim rail on the right.
   *
   * Mobile/tablet:
   * show a floating button inside the
   * workspace area so the drawer can be opened.
   */
  if (!isOpen) {
    return (
      <>
        <aside
          aria-label="Workspace tools"
          className="hidden w-9 shrink-0 items-start justify-center border-l border-(--border) bg-(--panel-bg) pt-3 xl:flex"
        >
          <button
            type="button"
            data-workspace-trigger="desktop"
            onClick={(event) =>
              handleOpen(event)
            }
            aria-label="Open workspace tools"
            title="Open workspace"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
          >
            <ChevronLeft
              size={16}
              aria-hidden="true"
            />
          </button>
        </aside>

        <button
          type="button"
          data-workspace-trigger="mobile"
          onClick={(event) =>
            handleOpen(event)
          }
          aria-label="Open workspace"
          title="Open workspace"
          className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-lg border border-(--border) bg-(--panel-bg) text-(--text-muted) shadow-sm transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) xl:hidden"
        >
          <PanelRight
            size={16}
            aria-hidden="true"
          />
        </button>
      </>
    );
  }

  return (
    <>
      {/* Mobile/tablet backdrop */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={closeRightPanel}
        className="absolute inset-0 z-40 bg-(--overlay-backdrop) xl:hidden"
      />

      <aside
        ref={drawerRef}
        role={isDrawer ? "dialog" : undefined}
        aria-modal={isDrawer ? "true" : undefined}
        aria-label={
          isDrawer
            ? undefined
            : "Workspace tools"
        }
        aria-labelledby={
          isDrawer
            ? workspaceTitleId
            : undefined
        }
        tabIndex={isDrawer ? -1 : undefined}
        className="absolute inset-y-0 right-0 z-50 flex w-[min(92vw,360px)] flex-col border-l border-(--border) bg-(--panel-bg) shadow-[var(--elevated-shadow)] xl:static xl:w-[clamp(280px,25vw,352px)] xl:shrink-0 xl:border-l xl:shadow-none"
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-(--border) px-3">
          <PanelRight
            size={16}
            className="shrink-0 text-(--text-muted)"
            aria-hidden="true"
          />

          <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-(--text-primary)">
            <span id={workspaceTitleId}>
              Workspace
            </span>
          </h3>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeRightPanel}
            aria-label="Close workspace"
            title="Close workspace"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) xl:h-7 xl:w-7"
          >
            <X
              size={15}
              aria-hidden="true"
            />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
          <RightDock />
        </div>
      </aside>
    </>
  );
}
