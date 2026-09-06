import {
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";

import { AppShell } from "./components/layout/AppShell";
import { AuthGate } from "./modules/auth/components/AuthGate";
import { ReverseContextNotice } from "./modules/context/components/ReverseContextNotice";
import { SourcePreviewPage } from "./modules/context/components/SourcePreviewPage";
import { VideoWorkspace } from "./modules/media/components/VideoWorkspace";
import { DailyPlanPage } from "./modules/todo/pages/DailyPlanPage";
import { TaskDetailPage } from "./modules/todo/pages/TaskDetailPage";
import { TasksPage } from "./modules/todo/pages/TasksPage";
import { NoteDetailPage } from "./modules/notes/pages/NoteDetailPage";
import { NotesPage } from "./modules/notes/pages/NotesPage";

function SourcePreviewRoute() {
  const { noteId } = useParams();
  const parsedNoteId = Number(noteId);

  if (
    !Number.isSafeInteger(parsedNoteId) ||
    parsedNoteId <= 0
  ) {
    return <Navigate to="/library" replace />;
  }

  return (
    <SourcePreviewPage
      noteId={parsedNoteId}
    />
  );
}

export default function App() {
  return (
    <AuthGate>
      <>
        <Routes>
          <Route
            path="/notes/:noteId/source"
            element={<SourcePreviewRoute />}
          />

          <Route element={<AppShell />}>
            <Route
              index
              element={
                <Navigate
                  to="/library"
                  replace
                />
              }
            />

            <Route
              path="/library"
              element={<VideoWorkspace />}
            />

            <Route
              path="/library/:libraryVideoId"
              element={<VideoWorkspace />}
            />

            <Route
              path="/notes"
              element={<NotesPage />}
            />

            <Route
              path="/notes/:noteId"
              element={<NoteDetailPage />}
            />

            <Route
              path="/tasks"
              element={<TasksPage />}
            />

            <Route
              path="/tasks/:taskId"
              element={<TaskDetailPage />}
            />

            <Route
              path="/plan"
              element={<DailyPlanPage />}
            />
          </Route>

          <Route
            path="*"
            element={
              <Navigate
                to="/library"
                replace
              />
            }
          />
        </Routes>

        <ReverseContextNotice />
      </>
    </AuthGate>
  );
}