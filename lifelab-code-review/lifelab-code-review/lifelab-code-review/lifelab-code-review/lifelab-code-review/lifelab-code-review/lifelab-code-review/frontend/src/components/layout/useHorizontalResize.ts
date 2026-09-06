import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface HorizontalResizeOptions {
  width: number;
  minWidth: number;
  maxWidth: number;
  resizeFrom: "left" | "right";
  onWidthChange: (width: number) => void;
}

export function useHorizontalResize({
  width,
  minWidth,
  maxWidth,
  resizeFrom,
  onWidthChange,
}: HorizontalResizeOptions) {
  const [isResizing, setIsResizing] =
    useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  useEffect(() => {
    if (!isResizing) {
      return;
    }

    const previousCursor =
      document.body.style.cursor;
    const previousUserSelect =
      document.body.style.userSelect;

    document.body.style.cursor =
      "col-resize";
    document.body.style.userSelect =
      "none";

    function handlePointerMove(
      event: PointerEvent,
    ) {
      const pointerDelta =
        event.clientX -
        startXRef.current;
      const widthDelta =
        resizeFrom === "left"
          ? pointerDelta
          : -pointerDelta;

      onWidthChange(
        startWidthRef.current +
          widthDelta,
      );
    }

    function stopResizing() {
      setIsResizing(false);
    }

    window.addEventListener(
      "pointermove",
      handlePointerMove,
    );
    window.addEventListener(
      "pointerup",
      stopResizing,
    );
    window.addEventListener(
      "pointercancel",
      stopResizing,
    );
    window.addEventListener(
      "blur",
      stopResizing,
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );
      window.removeEventListener(
        "pointerup",
        stopResizing,
      );
      window.removeEventListener(
        "pointercancel",
        stopResizing,
      );
      window.removeEventListener(
        "blur",
        stopResizing,
      );

      document.body.style.cursor =
        previousCursor;
      document.body.style.userSelect =
        previousUserSelect;
    };
  }, [
    isResizing,
    onWidthChange,
    resizeFrom,
  ]);

  const handlePointerDown =
    useCallback(
      (
        event: ReactPointerEvent<HTMLElement>,
      ) => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        startXRef.current =
          event.clientX;
        startWidthRef.current =
          width;
        setIsResizing(true);
      },
      [width],
    );

  const handleKeyDown =
    useCallback(
      (
        event: ReactKeyboardEvent<HTMLElement>,
      ) => {
        if (event.key === "Home") {
          event.preventDefault();
          onWidthChange(minWidth);
          return;
        }

        if (event.key === "End") {
          event.preventDefault();
          onWidthChange(maxWidth);
          return;
        }

        if (
          event.key !== "ArrowLeft" &&
          event.key !== "ArrowRight"
        ) {
          return;
        }

        event.preventDefault();

        const physicalDelta =
          event.key === "ArrowRight"
            ? 16
            : -16;
        const widthDelta =
          resizeFrom === "left"
            ? physicalDelta
            : -physicalDelta;

        onWidthChange(
          width + widthDelta,
        );
      },
      [
        maxWidth,
        minWidth,
        onWidthChange,
        resizeFrom,
        width,
      ],
    );

  return {
    isResizing,
    handlePointerDown,
    handleKeyDown,
  };
}
