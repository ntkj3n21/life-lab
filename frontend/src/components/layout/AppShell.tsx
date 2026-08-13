import {
  Outlet,
  useLocation,
} from "react-router-dom";

import { MobileNavigation } from "./MobileNavigation";
import { RightPanel } from "./RightPanel";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell() {
  const { pathname } = useLocation();

  const isLibraryWorkspace =
    pathname === "/library" ||
    pathname.startsWith(
      "/library/",
    );

  return (
    <div className="flex h-full w-full overflow-hidden bg-(--app-bg) text-(--text-primary)">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <MobileNavigation />

        <section className="flex min-h-0 flex-1 overflow-hidden">
          <Outlet />

          {isLibraryWorkspace && (
            <RightPanel />
          )}
        </section>
      </div>
    </div>
  );
}
