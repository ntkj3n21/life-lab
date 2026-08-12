import { useState } from "react";
import {
  LogOut,
  UserRound,
} from "lucide-react";
import { useLocation } from "react-router-dom";

import { useAuthStore } from "../../stores/authStore";

function getSectionCopy(pathname: string) {
  if (pathname.startsWith("/notes")) {
    return {
      title: "Notes",
      description:
        "Review notes and restore their exact source context.",
    };
  }

  if (pathname.startsWith("/tasks")) {
    return {
      title: "Tasks",
      description:
        "Manage work while preserving its original source when available.",
    };
  }

  if (pathname.startsWith("/plan")) {
    return {
      title: "Daily Plan",
      description:
        "Work from the same Tasks, grouped by their current deadline state.",
    };
  }

  return {
    title: "Library",
    description:
      "Organize YouTube sources and work with them in context.",
  };
}

export function Topbar() {
  const { pathname } =
    useLocation();

  const account = useAuthStore(
    (state) => state.account,
  );

  const logout = useAuthStore(
    (state) => state.logout,
  );

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  const section =
    getSectionCopy(pathname);

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
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-neutral-800 px-4 sm:px-6">
      <div className="min-w-0">
        <h2 className="truncate text-base font-semibold sm:text-lg">
          {section.title}
        </h2>

        <p className="hidden truncate text-sm text-neutral-400 lg:block">
          {section.description}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300">
          <UserRound
            size={17}
            aria-hidden="true"
          />
        </div>

        <div className="hidden max-w-48 sm:block">
          <p className="truncate text-sm font-medium text-neutral-200">
            {account?.displayName ??
              "Life Lab User"}
          </p>

          <p className="truncate text-xs text-neutral-500">
            {account?.email ?? ""}
          </p>
        </div>

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
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LogOut
            size={16}
            aria-hidden="true"
          />
        </button>
      </div>
    </header>
  );
}