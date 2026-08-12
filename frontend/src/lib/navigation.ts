export function navigateToPath(
  path: string,
  replace = false,
) {
  if (
    window.location.pathname ===
    path
  ) {
    return;
  }

  if (replace) {
    window.history.replaceState(
      {},
      "",
      path,
    );
  } else {
    window.history.pushState(
      {},
      "",
      path,
    );
  }

  window.dispatchEvent(
    new PopStateEvent(
      "popstate",
    ),
  );
}