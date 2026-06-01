import { useState } from "react";

import { useContextStore } from "../../../stores/contextStore";
import { useNoteStore } from "../../../stores/noteStore";

export function QuickNotePanel() {
  const [noteContent, setNoteContent] = useState("");

  const activeContext = useContextStore((state) => state.activeContext);
  const notes = useNoteStore((state) => state.notes);
  const addNote = useNoteStore((state) => state.addNote);

  function handleSaveNote() {
    const trimmedContent = noteContent.trim();

    if (!trimmedContent) return;

    addNote({
      content: trimmedContent,
      linkedEntityId: activeContext?.entityId,
      linkedEntityType: activeContext?.entityType,
      timestamp: activeContext?.timestamp,
    });

    setNoteContent("");
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
        <h4 className="font-medium">Saved Notes</h4>

        {notes.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Chưa có note nào.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900 p-3"
              >
                <p className="text-sm text-neutral-200">{note.content}</p>

                {note.linkedEntityId ? (
                  <p className="mt-2 text-xs text-neutral-500">
                    Linked to {note.linkedEntityType}: {note.linkedEntityId}
                  </p>
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