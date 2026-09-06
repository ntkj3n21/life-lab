import { useState } from "react";
import {
  CalendarDays,
  Library,
  ListTodo,
  LoaderCircle,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  StickyNote,
  Sun,
  UserRound,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { useAppearanceStore } from "../../stores/appearanceStore";
import { useAuthStore } from "../../stores/authStore";
import {
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  useLayoutStore,
} from "../../stores/layoutStore";
import { useHorizontalResize } from "./useHorizontalResize";

const navItems = [
  {
    to: "/library",
    label: "Library",
    icon: Library,
  },
  {
    to: "/notes",
    label: "Notes",
    icon: StickyNote,
  },
  {
    to: "/tasks",
    label: "Tasks",
    icon: ListTodo,
  },
  {
    to: "/plan",
    label: "Daily Plan",
    icon: CalendarDays,
  },
] as const;

export function Sidebar() {
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const isSidebarCollapsed =
    useLayoutStore(
      (state) =>
        state.isSidebarCollapsed,
    );

  const toggleSidebar =
    useLayoutStore(
      (state) =>
        state.toggleSidebar,
    );

  const sidebarWidth =
    useLayoutStore(
      (state) => state.sidebarWidth,
    );

  const setSidebarWidth =
    useLayoutStore(
      (state) =>
        state.setSidebarWidth,
    );

  const {
    isResizing,
    handlePointerDown,
    handleKeyDown,
  } = useHorizontalResize({
    width: sidebarWidth,
    minWidth: SIDEBAR_MIN_WIDTH,
    maxWidth: SIDEBAR_MAX_WIDTH,
    resizeFrom: "left",
    onWidthChange: setSidebarWidth,
  });

  const appearance =
    useAppearanceStore(
      (state) => state.appearance,
    );

  const toggleAppearance =
    useAppearanceStore(
      (state) =>
        state.toggleAppearance,
    );

  const account = useAuthStore(
    (state) => state.account,
  );

  const logout = useAuthStore(
    (state) => state.logout,
  );

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout();
    } catch {
      // authStore keeps the API error.
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <aside
      aria-label="Primary navigation"
      style={
        isSidebarCollapsed
          ? undefined
          : {
              width: sidebarWidth,
            }
      }
      className={`relative hidden shrink-0 flex-col border-r border-(--border) bg-(--panel-bg) xl:flex ${
        isResizing
          ? "transition-none"
          : "transition-[width] duration-200 motion-reduce:transition-none"
      } ${
        isSidebarCollapsed
          ? "w-16"
          : ""
      }`}
    >
      {!isSidebarCollapsed && (
        <div
          role="separator"
          aria-label="Resize sidebar"
          aria-orientation="vertical"
          aria-valuemin={
            SIDEBAR_MIN_WIDTH
          }
          aria-valuemax={
            SIDEBAR_MAX_WIDTH
          }
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          onPointerDown={
            handlePointerDown
          }
          onKeyDown={handleKeyDown}
          className="group absolute inset-y-0 -right-1 z-20 hidden w-2 cursor-col-resize touch-none outline-none xl:block"
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
      )}

      <div className="flex h-16 items-center gap-2 px-3">
        {!isSidebarCollapsed && (
          <div className="min-w-0 flex-1 px-1">
            <h1 className="truncate text-sm font-semibold tracking-[-0.01em] text-(--text-primary)">
              Life Lab
            </h1>

            <p className="truncate text-xs text-(--text-muted)">
              Study workspace
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={
            isSidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
          title={
            isSidebarCollapsed
              ? "Expand sidebar"
              : "Collapse sidebar"
          }
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${
            isSidebarCollapsed
              ? "mx-auto"
              : ""
          }`}
        >
          {isSidebarCollapsed ? (
            <PanelLeftOpen
              size={17}
              aria-hidden="true"
            />
          ) : (
            <PanelLeftClose
              size={17}
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-2">
        {navItems.map(
          ({
            to,
            label,
            icon: Icon,
          }) => (
            <NavLink
              key={to}
              to={to}
              className={({
                isActive,
              }) =>
                `flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${
                  isActive
                    ? "bg-(--surface-hover) font-medium text-(--text-primary)"
                    : "text-(--text-secondary) hover:bg-(--surface) hover:text-(--text-primary)"
                } ${
                  isSidebarCollapsed
                    ? "justify-center px-0"
                    : ""
                }`
              }
              title={
                isSidebarCollapsed
                  ? label
                  : undefined
              }
            >
              <Icon
                size={18}
                className="shrink-0"
                aria-hidden="true"
              />

              {!isSidebarCollapsed && (
                <span className="truncate">
                  {label}
                </span>
              )}
            </NavLink>
          ),
        )}
      </nav>

      <div className="border-t border-(--border) p-2">
        {!isSidebarCollapsed && (
          <div className="mb-2 flex items-center gap-3 rounded-[10px] px-2 py-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-(--surface-hover) text-(--text-secondary)">
              <UserRound
                size={15}
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-(--text-primary)">
                {account?.displayName ??
                  "Life Lab User"}
              </p>

              <p className="truncate text-[11px] text-(--text-muted)">
                {account?.email ?? ""}
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={toggleAppearance}
          aria-label={`Switch to ${
            appearance === "dark"
              ? "light"
              : "dark"
          } mode`}
          title={`Switch to ${
            appearance === "dark"
              ? "light"
              : "dark"
          } mode`}
          className={`flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm text-(--text-secondary) transition-colors hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) ${
            isSidebarCollapsed
              ? "justify-center px-0"
              : ""
          }`}
        >
          {appearance === "dark" ? (
            <Moon
              size={17}
              className="shrink-0"
              aria-hidden="true"
            />
          ) : (
            <Sun
              size={17}
              className="shrink-0"
              aria-hidden="true"
            />
          )}

          {!isSidebarCollapsed && (
            <span>
              {appearance === "dark"
                ? "Dark mode"
                : "Light mode"}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() =>
            void handleLogout()
          }
          disabled={isLoggingOut}
          aria-label={
            isLoggingOut
              ? "Signing out"
              : "Sign out"
          }
          title="Sign out"
          className={`flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-sm text-(--text-muted) transition-colors hover:bg-(--surface) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50 ${
            isSidebarCollapsed
              ? "justify-center px-0"
              : ""
          }`}
        >
          {isLoggingOut ? (
            <LoaderCircle
              size={17}
              className="shrink-0 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <LogOut
              size={17}
              className="shrink-0"
              aria-hidden="true"
            />
          )}

          {!isSidebarCollapsed && (
            <span>Sign out</span>
          )}
        </button>
      </div>
    </aside>
  );
}
