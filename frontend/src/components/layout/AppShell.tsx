import {
  Outlet,
  useLocation,
} from "react-router-dom";
import {
  useCallback,
  useState,
} from "react";

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
    pathname.startsWith(
      "/images/",
    ) ||
    pathname.startsWith(
      "/audio/",
    );

  const isLibraryVideoWorkspace =
    pathname.startsWith(
      "/library/",
    );

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
