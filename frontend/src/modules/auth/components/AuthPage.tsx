import { useState, type FormEvent } from "react";
import { FlaskConical, LogIn, UserPlus } from "lucide-react";

import { useAuthStore } from "../../../stores/authStore";

type AuthMode = "login" | "register";

export function AuthPage() {
  const login = useAuthStore((state) => state.login);
  const register = useAuthStore((state) => state.register);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setPassword("");
    setNotice(null);
    clearError();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    clearError();
    setNotice(null);
    setIsSubmitting(true);

    try {
      if (mode === "login") {
        await login({
          email,
          password,
        });

        return;
      }

      await register({
        email,
        password,
        displayName,
      });

      setMode("login");
      setPassword("");
      setDisplayName("");
      setNotice("Account created. Sign in to continue.");
    } catch {
      // authStore keeps the API error so the form can display it.
    } finally {
      setIsSubmitting(false);
    }
  }

  const emailError = error?.fieldErrors.email;
  const passwordError = error?.fieldErrors.password;
  const displayNameError = error?.fieldErrors.displayName;

  return (
    <main className="flex min-h-screen items-center justify-center bg-(--app-bg) py-10 text-(--text-primary)">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-(--border) bg-(--surface)">
            <FlaskConical size={26} />
          </div>

          <h1 className="mt-4 text-2xl font-semibold">
            Life Lab
          </h1>

          <p className="mt-2 text-sm text-(--text-muted)">
            Your personal digital workspace.
          </p>
        </div>

        <div className="rounded-2xl border border-(--border) bg-(--surface) p-6 shadow-2xl shadow-black/20">
          <div className="grid grid-cols-2 rounded-xl bg-(--app-bg) p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-(--surface-hover) text-(--text-primary)"
                  : "text-(--text-muted) hover:text-(--text-secondary)"
              }`}
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "register"
                  ? "bg-(--surface-hover) text-(--text-primary)"
                  : "text-(--text-muted) hover:text-(--text-secondary)"
              }`}
            >
              Create account
            </button>
          </div>

          <div className="mt-6">
            <h2 className="text-xl font-semibold">
              {mode === "login"
                ? "Welcome back"
                : "Create your account"}
            </h2>

            <p className="mt-1 text-sm text-(--text-muted)">
              {mode === "login"
                ? "Sign in to continue to your workspace."
                : "Create an account to start using Life Lab."}
            </p>
          </div>

          {notice && (
            <div className="mt-5 rounded-xl border border-(--success-border) bg-(--success-surface) px-4 py-3 text-sm text-(--success-text)">
              {notice}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-(--danger-border) bg-(--danger-surface) px-4 py-3 text-sm text-(--danger-text)">
              {error.message}
            </div>
          )}

          <form
            className="mt-6 space-y-4"
            onSubmit={handleSubmit}
          >
            {mode === "register" && (
              <div>
                <label
                  htmlFor="displayName"
                  className="mb-2 block text-sm font-medium text-(--text-secondary)"
                >
                  Display name
                </label>

                <input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(event) =>
                    setDisplayName(event.target.value)
                  }
                  autoComplete="name"
                  className="w-full rounded-xl border border-(--border) bg-(--app-bg) px-4 py-3 text-sm outline-none transition placeholder:text-(--text-faint) focus:border-(--border-strong)"
                  placeholder="Your name"
                />

                {displayNameError && (
                  <p className="mt-1.5 text-xs text-(--danger-text)">
                    {displayNameError}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-(--text-secondary)"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                className="w-full rounded-xl border border-(--border) bg-(--app-bg) px-4 py-3 text-sm outline-none transition placeholder:text-(--text-faint) focus:border-(--border-strong)"
                placeholder="you@example.com"
              />

              {emailError && (
                <p className="mt-1.5 text-xs text-(--danger-text)">
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-(--text-secondary)"
              >
                Password
              </label>

              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                autoComplete={
                  mode === "login"
                    ? "current-password"
                    : "new-password"
                }
                className="w-full rounded-xl border border-(--border) bg-(--app-bg) px-4 py-3 text-sm outline-none transition placeholder:text-(--text-faint) focus:border-(--border-strong)"
                placeholder={
                  mode === "register"
                    ? "At least 8 characters"
                    : "Your password"
                }
              />

              {passwordError && (
                <p className="mt-1.5 text-xs text-(--danger-text)">
                  {passwordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-(--primary-bg) px-4 py-3 text-sm font-semibold text-(--primary-text) transition hover:bg-(--primary-bg) disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mode === "login" ? (
                <LogIn size={17} />
              ) : (
                <UserPlus size={17} />
              )}

              {isSubmitting
                ? "Please wait..."
                : mode === "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}