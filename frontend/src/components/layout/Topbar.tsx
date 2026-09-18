import { useState } from "react";
import {
  LoaderCircle,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import { useAppearanceStore } from "../../stores/appearanceStore";
import { useAuthStore } from "../../stores/authStore";

function getSectionTitle(
  pathname: string,
) {
  if (pathname.startsWith("/notes")) {
    return "Notes";
  }

  if (
    pathname.startsWith("/library") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/audio")
  ) {
    return "Library";
  }

  if (pathname.startsWith("/tasks")) {
    return "Tasks";
  }

  if (pathname.startsWith("/plan")) {
    return "Daily Plan";
  }

  return "Library";
}

export function Topbar() {
  const { pathname } = useLocation();
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const appearance =
    useAppearanceStore(
      (state) => state.appearance,
    );

  const toggleAppearance =
    useAppearanceStore(
      (state) =>
        state.toggleAppearance,
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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-(--border) bg-(--app-bg-translucent) px-4 backdrop-blur-sm sm:px-5">
      <h2 className="truncate text-sm font-medium text-(--text-primary)">
        {getSectionTitle(pathname)}
      </h2>

      <div className="flex items-center gap-1 xl:hidden">
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
          className="flex h-10 w-10 items-center justify-center rounded-[10px] text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus)"
        >
          {appearance === "dark" ? (
            <Moon
              size={17}
              aria-hidden="true"
            />
          ) : (
            <Sun
              size={17}
              aria-hidden="true"
            />
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
          className="flex h-10 w-10 items-center justify-center rounded-[10px] text-(--text-muted) transition-colors hover:bg-(--surface-hover) hover:text-(--text-primary) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoggingOut ? (
            <LoaderCircle
              size={17}
              className="animate-spin"
              aria-hidden="true"
            />
          ) : (
            <LogOut
              size={17}
              aria-hidden="true"
            />
          )}
        </button>
      </div>
    </header>
  );
}
