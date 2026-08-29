import {
  ChevronLeft,
  PanelRight,
  X,
} from "lucide-react";
import {
  type CSSProperties,
  type MouseEvent,
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
} from "react";

import {
  RIGHT_PANEL_MAX_WIDTH,
  RIGHT_PANEL_MIN_WIDTH,
  useLayoutStore,
} from "../../stores/layoutStore";
import { RightDock } from "./RightDock";
import { useHorizontalResize } from "./useHorizontalResize";

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

interface RightPanelProps {
  isFocusMode: boolean;
}

export function RightPanel({
  isFocusMode,
}: RightPanelProps) {
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

  const rightPanelWidth =
    useLayoutStore(
      (state) =>
        state.rightPanelWidth,
    );

  const setRightPanelWidth =
    useLayoutStore(
      (state) =>
        state.setRightPanelWidth,
    );

  const {
    isResizing,
    handlePointerDown,
    handleKeyDown,
  } = useHorizontalResize({
    width: rightPanelWidth,
    minWidth: RIGHT_PANEL_MIN_WIDTH,
    maxWidth: RIGHT_PANEL_MAX_WIDTH,
    resizeFrom: "right",
    onWidthChange: setRightPanelWidth,
  });

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
          className={`hidden w-9 shrink-0 items-start justify-center border-l border-(--border) bg-(--panel-bg) pt-3 ${
            isFocusMode
              ? "xl:hidden"
              : "xl:flex"
          }`}
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

        {isFocusMode && (
          <button
            type="button"
            data-workspace-trigger="desktop"
            onClick={(event) =>
              handleOpen(event)
            }
            aria-label="Open workspace"
            title="Open workspace"
            className="absolute bottom-4 right-4 z-20 hidden h-9 w-9 items-center justify-center rounded-lg border border-(--border) bg-(--panel-bg) text-(--text-muted) shadow-sm transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) xl:flex"
          >
            <PanelRight
              size={16}
              aria-hidden="true"
            />
          </button>
        )}

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
        style={
          {
            "--right-panel-width": `${rightPanelWidth}px`,
          } as CSSProperties
        }
        className="absolute inset-y-0 right-0 z-50 flex w-[min(92vw,360px)] flex-col border-l border-(--border) bg-(--panel-bg) shadow-[var(--elevated-shadow)] xl:relative xl:w-(--right-panel-width) xl:shrink-0 xl:border-l xl:shadow-none"
      >
        <div
          role="separator"
          aria-label="Resize workspace"
          aria-orientation="vertical"
          aria-valuemin={
            RIGHT_PANEL_MIN_WIDTH
          }
          aria-valuemax={
            RIGHT_PANEL_MAX_WIDTH
          }
          aria-valuenow={rightPanelWidth}
          tabIndex={0}
          onPointerDown={
            handlePointerDown
          }
          onKeyDown={handleKeyDown}
          className="group absolute inset-y-0 -left-1 z-20 hidden w-2 cursor-col-resize touch-none outline-none xl:block"
        >
          <span
            aria-hidden="true"
            className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-(--border-strong) group-focus-visible:bg-(--focus) ${
              isResizing
                ? "bg-(--border-strong)"
                : ""
            }`}
          />
        </div>

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
