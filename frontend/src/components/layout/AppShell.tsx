import {
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  useCallback,
  useLayoutEffect,
  useState,
} from "react";

import { useContextStore } from "../../stores/contextStore";
import { MobileNavigation } from "./MobileNavigation";
import { RightPanel } from "./RightPanel";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export interface AppShellOutletContext {
  isFocusMode: boolean;
  enterFocusMode: () => void;
  exitFocusMode: () => void;
}

export function AppShell() {
  const { pathname } = useLocation();
  const [
    isFocusMode,
    setIsFocusMode,
  ] = useState(false);

  const isLibraryWorkspace =
    pathname === "/library" ||
    pathname.startsWith(
      "/library/",
    ) ||
    pathname === "/images" ||
    pathname.startsWith(
      "/images/",
    ) ||
    pathname === "/audio" ||
    pathname.startsWith(
      "/audio/",
    );

  const isLibraryVideoWorkspace =
    pathname.startsWith(
      "/library/",
    );

  const routeSourceType =
    pathname.startsWith("/library/")
      ? "video"
      : pathname.startsWith("/images/")
        ? "image"
        : pathname.startsWith("/audio/")
          ? "audio"
          : null;
  const routeSourceId = routeSourceType ? pathname.split("/")[2] : null;

  // Media detail pages resolve their next source asynchronously. Keep an exact
  // reverse-navigation context, but clear a previous route's source before
  // Right Workspace can paint it under the new media mode.
  useLayoutEffect(() => {
    if (!isLibraryWorkspace) return;

    const context = useContextStore.getState().activeContext;

    if (
      context &&
      (!routeSourceType ||
        context.entityType !== routeSourceType ||
        context.entityId !== routeSourceId)
    ) {
      useContextStore.getState().clearActiveContext();
    }
  }, [pathname, isLibraryWorkspace, routeSourceType, routeSourceId]);

  const showFocusPresentation =
    isFocusMode &&
    isLibraryVideoWorkspace;

  const enterFocusMode =
    useCallback(() => {
      setIsFocusMode(true);
    }, []);

  const exitFocusMode =
    useCallback(() => {
      setIsFocusMode(false);
    }, []);

  return (
    <div className="flex h-full w-full overflow-hidden bg-(--app-bg) text-(--text-primary)">
      <div
        className={`contents ${
          showFocusPresentation
            ? "xl:[&>aside]:hidden"
            : ""
        }`}
      >
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className={`contents ${
            showFocusPresentation
              ? "xl:[&>header]:hidden"
              : ""
          }`}
        >
          <Topbar />
        </div>
        <MobileNavigation />

        <section className="relative flex min-h-0 flex-1 overflow-hidden">
          <div id="library-main-pane" className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <Outlet
              context={
                {
                  isFocusMode:
                    showFocusPresentation,
                  enterFocusMode,
                  exitFocusMode,
                } satisfies AppShellOutletContext
              }
            />
          </div>

          {isLibraryWorkspace && (
            <RightPanel
              isFocusMode={
                showFocusPresentation
              }
            />
          )}
        </section>
      </div>
    </div>
  );
}
