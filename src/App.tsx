import { MiniPlayer } from "./components/layout/MiniPlayer";
import { RightDock } from "./components/layout/RightDock";
import { Sidebar } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { VideoWorkspace } from "./modules/media/components/VideoWorkspace";

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden bg-neutral-950 text-neutral-100">
      <Sidebar />

      <main className="flex min-w-0 flex-1 flex-col">
        <Topbar />

        <section className="flex min-h-0 flex-1 overflow-hidden">
          <VideoWorkspace />
          <RightDock />
        </section>

        <MiniPlayer />
      </main>
    </div>
  );
}