import { useState } from "react";

import { useVideoStore } from "../../../stores/videoStore";
import { useContextStore } from "../../../stores/contextStore";
import { useNoteStore } from "../../../stores/noteStore";
import { useTodoStore } from "../../../stores/todoStore";

export function QuickNotePanel() {
  const [noteContent, setNoteContent] = useState("");

  const activeContext = useContextStore((state) => state.activeContext);
  const setActiveContext = useContextStore((state) => state.setActiveContext);
  const videos = useVideoStore((state) => state.videos);
  const notes = useNoteStore((state) => state.notes);
  const addNote = useNoteStore((state) => state.addNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const clearNotes = useNoteStore((state) => state.clearNotes);
  const addTodo = useTodoStore((state) => state.addTodo);
  const sortedNotes = [...notes].sort((a, b) => {
  const aIsCurrentContext = a.linkedEntityId === activeContext?.entityId;
  const bIsCurrentContext = b.linkedEntityId === activeContext?.entityId;

  if (aIsCurrentContext && !bIsCurrentContext) return -1;
  if (!aIsCurrentContext && bIsCurrentContext) return 1;

  return b.createdAt - a.createdAt;
});

  function handleSaveNote() {
    const trimmedContent = noteContent.trim();

    if (!trimmedContent) return;

    addNote({
      content: trimmedContent,
      linkedEntityId: activeContext?.entityId,
      linkedEntityType: activeContext?.entityType,
      linkedEntityTitle: activeContext?.title,
      timestamp: activeContext?.timestamp,
    });

    setNoteContent("");
  }
  
  function handleOpenLinkedVideo(videoId: string) {
    const linkedVideo = videos.find((video) => video.id === videoId);

    if (!linkedVideo) return;

    setActiveContext({
      entityId: linkedVideo.id,
      entityType: linkedVideo.type,
      title: linkedVideo.title,
      timestamp: 0,
    });
  }
  function handleCreateTodoFromNote(noteId: string) {
    const note = notes.find((item) => item.id === noteId);

    if (!note) return;

    addTodo({
      content: note.content,
      linkedEntityId: note.linkedEntityId ?? note.id,
      linkedEntityType: note.linkedEntityType ?? note.type,
      linkedEntityTitle: note.linkedEntityTitle ?? note.title,
    });
  }
  return (
    <>
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <label className="text-sm font-medium text-neutral-300">
          Quick Note
        </label>

        <textarea
          value={noteContent}
          onChange={(event) => setNoteContent(event.target.value)}
          className="mt-3 h-40 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
          placeholder="Ghi chú nhanh ở đây..."
        />

        <button
          onClick={handleSaveNote}
          className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
        >
          Save note
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
        <h4 className="font-medium">Linked Items</h4>

        {activeContext ? (
          <p className="mt-2 text-sm text-neutral-400">
            Note mới sẽ link với{" "}
            <span className="text-neutral-200">{activeContext.title}</span>.
          </p>
        ) : (
          <p className="mt-2 text-sm text-neutral-500">
            Chưa có context. Note sẽ được lưu như note thường.
          </p>
        )}
      </div>

<div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
  <div className="flex items-center justify-between gap-3">
    <h4 className="font-medium">Saved Notes</h4>

    {notes.length > 0 && (
      <button
        onClick={clearNotes}
        className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-white"
      >
        Clear
      </button>
    )}
  </div>

  {notes.length === 0 ? (
    <p className="mt-2 text-sm text-neutral-500">Chưa có note nào.</p>
  ) : (
    <div className="mt-3 space-y-3">
      {sortedNotes.map((note) => (
        <div
          key={note.id}
          className="rounded-xl border border-neutral-800 bg-neutral-900 p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-neutral-200">{note.content}</p>

            <div className="flex shrink-0 flex-col gap-2">
              <button
                onClick={() => handleCreateTodoFromNote(note.id)}
                className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white"
              >
                Todo
              </button>

              <button
                onClick={() => deleteNote(note.id)}
                className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-800 hover:text-white"
              >
                Delete
              </button>
            </div>
          </div>

          {note.linkedEntityId ? (
            <>
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-xs text-neutral-500">
                  Linked to {note.linkedEntityType}:{" "}
                  <span className="text-neutral-300">
                    {note.linkedEntityTitle ?? note.linkedEntityId}
                  </span>
                </p>

                {note.linkedEntityType === "video" && (
                  <button
                    onClick={() => handleOpenLinkedVideo(note.linkedEntityId!)}
                    className="shrink-0 rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    Open
                  </button>
                )}
              </div>

              {note.linkedEntityId === activeContext?.entityId && (
                <p className="mt-1 text-xs text-emerald-400">
                  Current context note
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-xs text-neutral-600">
              No linked context
            </p>
          )}

        </div>
      ))}
    </div>
  )}
</div>
    </>
  );
}