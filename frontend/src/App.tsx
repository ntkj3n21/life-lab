import {
  useEffect,
  useState,
} from "react";

import { MusicAudioEngine } from "./components/layout/MusicAudioEngine";
import { RightPanel } from "./components/layout/RightPanel";
import { RightRail } from "./components/layout/RightRail";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";

import { AuthGate } from "./modules/auth/components/AuthGate";

import { SourcePreviewPage } from "./modules/context/components/SourcePreviewPage";

import { VideoWorkspace } from "./modules/media/components/VideoWorkspace";

function getSourcePreviewNoteId(
  pathname: string,
) {
  const match =
    pathname.match(
      /^\/notes\/(\d+)\/source\/?$/,
    );

  if (!match) {
    return null;
  }

  const noteId =
    Number(match[1]);

  return Number.isSafeInteger(
    noteId,
  ) && noteId > 0
    ? noteId
    : null;
}

export default function App() {
  const [
    pathname,
    setPathname,
  ] = useState(
    () =>
      window.location.pathname,
  );

  useEffect(() => {
    function handlePopState() {
      setPathname(
        window.location.pathname,
      );
    }

    window.addEventListener(
      "popstate",
      handlePopState,
    );

    return () => {
      window.removeEventListener(
        "popstate",
        handlePopState,
      );
    };
  }, []);

  const sourcePreviewNoteId =
    getSourcePreviewNoteId(
      pathname,
    );

  return (
    <AuthGate>
      {sourcePreviewNoteId !==
      null ? (
        <SourcePreviewPage
          noteId={
            sourcePreviewNoteId
          }
        />
      ) : (
        <div className="flex h-screen overflow-hidden bg-neutral-950 text-neutral-100">
          <MusicAudioEngine />

          <Sidebar />

          <main className="flex min-w-0 flex-1 flex-col">
            <Topbar />

            <section className="flex min-h-0 flex-1 overflow-hidden">
              <VideoWorkspace />

              <RightPanel />

              <RightRail />
            </section>
          </main>
        </div>
      )}
    </AuthGate>
  );
}