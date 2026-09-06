export type Appearance = "dark" | "light";

export const APPEARANCE_STORAGE_KEY =
  "life-lab-appearance";

export function getInitialAppearance(): Appearance {
  if (typeof window === "undefined") {
    return "dark";
  }

  try {
    return window.localStorage.getItem(
      APPEARANCE_STORAGE_KEY,
    ) === "light"
      ? "light"
      : "dark";
  } catch {
    return "dark";
  }
}

export function applyAppearance(
  appearance: Appearance,
  persist = true,
) {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme =
      appearance;
    document.documentElement.style.colorScheme =
      appearance;
  }

  if (!persist || typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      APPEARANCE_STORAGE_KEY,
      appearance,
    );
  } catch {
    // The UI can still switch theme when storage is unavailable.
  }
}
