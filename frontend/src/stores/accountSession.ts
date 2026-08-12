import { useContextStore } from "./contextStore";
import { useLibraryStore } from "./libraryStore";
import { useNoteStore } from "./noteStore";
import { useReverseContextStore } from "./reverseContextStore";
import { useTagStore } from "./tagStore";
import { useTodoStore } from "./todoStore";
import { useWatchStore } from "./watchStore";

function wait(
  milliseconds: number,
) {
  return new Promise<void>(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds,
      );
    },
  );
}

export async function prepareForAccountLogout() {
  /*
   * Clearing the active context lets
   * VideoWorkspace close the current
   * WatchSession with its pending
   * playback time.
   */
  useContextStore
    .getState()
    .clearActiveContext();

  const timeoutAt =
    performance.now() + 1500;

  while (
    performance.now() <
    timeoutAt
  ) {
    const session =
      useWatchStore.getState()
        .session;

    if (
      !session ||
      session.endedAt !== null
    ) {
      return;
    }

    await wait(25);
  }

  /*
   * Safety fallback. Never leave an
   * open WatchSession just because the
   * UI close did not finish in time.
   */
  try {
    await useWatchStore
      .getState()
      .close(0);
  } catch {
    // Logout must still be allowed.
  }
}

export function resetAccountScopedState() {
  useContextStore
    .getState()
    .clearActiveContext();

  useLibraryStore
    .getState()
    .reset();

  useNoteStore
    .getState()
    .reset();

  useReverseContextStore
    .getState()
    .reset();

  useTagStore
    .getState()
    .reset();

  useTodoStore
    .getState()
    .reset();

  useWatchStore
    .getState()
    .reset();

}