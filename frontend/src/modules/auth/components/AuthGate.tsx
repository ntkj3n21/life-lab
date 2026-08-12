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
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-100">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-neutral-200" />

          <p className="mt-4 text-sm text-neutral-500">
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
        <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 text-neutral-100">
          <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-900 p-6 text-center">
            <h1 className="text-lg font-semibold">
              Unable to start Life Lab
            </h1>

            <p className="mt-2 text-sm text-neutral-400">
              {error.message}
            </p>

            <button
              type="button"
              onClick={() => void initialize()}
              className="mt-5 rounded-xl bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-white"
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