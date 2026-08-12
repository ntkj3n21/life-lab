import {
  useState,
} from "react";

import {
  LogOut,
  UserRound,
} from "lucide-react";

import {
  useAuthStore,
} from "../../stores/authStore";

export function Topbar() {
  const account =
    useAuthStore(
      (state) =>
        state.account,
    );

  const logout =
    useAuthStore(
      (state) =>
        state.logout,
    );

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

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
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-neutral-800 px-6">
      <div>
        <h2 className="text-lg font-semibold">
          Media Workspace
        </h2>

        <p className="text-sm text-neutral-400">
          Xem video, nghe nhạc, ghi chú mà không rời context.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-neutral-800 text-neutral-300">
            <UserRound
              size={17}
            />
          </div>

          <div className="hidden max-w-48 sm:block">
            <p className="truncate text-sm font-medium text-neutral-200">
              {account
                ?.displayName ??
                "Life Lab User"}
            </p>

            <p className="truncate text-xs text-neutral-500">
              {account?.email ??
                ""}
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void handleLogout()
            }
            disabled={
              isLoggingOut
            }
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <LogOut
              size={16}
            />
          </button>
        </div>
      </div>
    </header>
  );
}