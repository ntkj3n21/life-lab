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
        className={`contents [&>aside]:transition-[opacity,visibility] [&>aside]:duration-200 [&>aside]:ease-out motion-reduce:[&>aside]:transition-none ${
          showFocusPresentation
            ? "[&>aside]:invisible [&>aside]:opacity-0"
            : "[&>aside]:visible [&>aside]:opacity-100"
        }`}
      >
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          className={`contents xl:[&>header]:transition-[opacity,visibility] xl:[&>header]:duration-200 xl:[&>header]:ease-out motion-reduce:xl:[&>header]:transition-none ${
            showFocusPresentation
              ? "xl:[&>header]:invisible xl:[&>header]:opacity-0"
              : "xl:[&>header]:visible xl:[&>header]:opacity-100"
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
            <RightPanel />
          )}
        </section>
      </div>
    </div>
  );
}
