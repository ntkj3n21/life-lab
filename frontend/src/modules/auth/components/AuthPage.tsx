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
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-10 text-neutral-100">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900">
            <FlaskConical size={26} />
          </div>

          <h1 className="mt-4 text-2xl font-semibold">
            Life Lab
          </h1>

          <p className="mt-2 text-sm text-neutral-500">
            Your personal digital workspace.
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-6 shadow-2xl shadow-black/20">
          <div className="grid grid-cols-2 rounded-xl bg-neutral-950 p-1">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "login"
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                mode === "register"
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-300"
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

            <p className="mt-1 text-sm text-neutral-500">
              {mode === "login"
                ? "Sign in to continue to your workspace."
                : "Create an account to start using Life Lab."}
            </p>
          </div>

          {notice && (
            <div className="mt-5 rounded-xl border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
              {notice}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
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
                  className="mb-2 block text-sm font-medium text-neutral-300"
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
                  className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-700 focus:border-neutral-600"
                  placeholder="Your name"
                />

                {displayNameError && (
                  <p className="mt-1.5 text-xs text-red-400">
                    {displayNameError}
                  </p>
                )}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-neutral-300"
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
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-700 focus:border-neutral-600"
                placeholder="you@example.com"
              />

              {emailError && (
                <p className="mt-1.5 text-xs text-red-400">
                  {emailError}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-neutral-300"
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
                className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm outline-none transition placeholder:text-neutral-700 focus:border-neutral-600"
                placeholder={
                  mode === "register"
                    ? "At least 8 characters"
                    : "Your password"
                }
              />

              {passwordError && (
                <p className="mt-1.5 text-xs text-red-400">
                  {passwordError}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-100 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
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