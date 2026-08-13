import type { ReactNode } from "react";

import { useAuthStore } from "../../../stores/authStore";
import { AuthPage } from "./AuthPage";

interface AuthGateProps {
  children: ReactNode;
}

export function AuthGate({ children }: AuthGateProps) {
  const isAuthenticated = useAuthStore(
    (state) => state.isAuthenticated,
  );

  const isInitializing = useAuthStore(
    (state) => state.isInitializing,
  );

  const error = useAuthStore(
    (state) => state.error,
  );

  const initialize = useAuthStore(
    (state) => state.initialize,
  );

  if (isInitializing) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-(--app-bg) text-(--text-primary)">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-(--border-strong) border-t-(--text-primary)" />

          <p className="mt-4 text-sm text-(--text-muted)">
            Loading Life Lab...
          </p>
        </div>
      </main>
    );
  }

  if (!isAuthenticated) {
    if (
      error &&
      error.status !== 401 &&
      error.code !== "UNAUTHENTICATED"
    ) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-(--app-bg) px-4 text-(--text-primary)">
          <div className="w-full max-w-md rounded-2xl border border-(--border) bg-(--surface) p-6 text-center">
            <h1 className="text-lg font-semibold">
              Unable to start Life Lab
            </h1>

            <p className="mt-2 text-sm text-(--text-secondary)">
              {error.message}
            </p>

            <button
              type="button"
              onClick={() => void initialize()}
              className="mt-5 rounded-xl bg-(--primary-bg) px-4 py-2 text-sm font-semibold text-(--primary-text) hover:bg-(--primary-bg)"
            >
              Try again
            </button>
          </div>
        </main>
      );
    }

    return <AuthPage />;
  }

  return <>{children}</>;
}