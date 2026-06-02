import { useState } from "react";
import { StickyNote, Trash2 } from "lucide-react";
import { useVideoStore } from "../../../stores/videoStore";
import { useContextStore } from "../../../stores/contextStore";
import { useNoteStore } from "../../../stores/noteStore";
import { useTodoStore } from "../../../stores/todoStore";
import { formatTime } from "../../../utils/formatTime";

type CaptureMode = "note" | "todo";

export function QuickNotePanel() {
  const [captureContent, setCaptureContent] = useState("");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("note");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");
  const activeContext = useContextStore((state) => state.activeContext);
  const setActiveContext = useContextStore((state) => state.setActiveContext);
  const videos = useVideoStore((state) => state.videos);
  const notes = useNoteStore((state) => state.notes);
  const addNote = useNoteStore((state) => state.addNote);
  const updateNote = useNoteStore((state) => state.updateNote);
  const deleteNote = useNoteStore((state) => state.deleteNote);
  const clearNotes = useNoteStore((state) => state.clearNotes);
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>([]);
  const addTodo = useTodoStore((state) => state.addTodo);
  const currentContextNotes = activeContext
    ? notes
        .filter((note) => note.linkedEntityId === activeContext.entityId)
        .sort((a, b) => {
          const aTimestamp = a.timestamp ?? 0;
          const bTimestamp = b.timestamp ?? 0;

          if (aTimestamp !== bTimestamp) {
            return aTimestamp - bTimestamp;
          }

          return b.createdAt - a.createdAt;
        })
    : [];

  const otherNotes = activeContext
    ? notes
        .filter((note) => note.linkedEntityId !== activeContext.entityId)
        .sort((a, b) => b.createdAt - a.createdAt)
    : [...notes].sort((a, b) => b.createdAt - a.createdAt);

  function handleSaveCapture() {
    const trimmedContent = captureContent.trim();

    if (!trimmedContent) return;

    const linkedData = {
      linkedEntityId: activeContext?.entityId,
      linkedEntityType: activeContext?.entityType,
      linkedEntityTitle: activeContext?.title,
      timestamp: activeContext?.timestamp,
    };

    if (captureMode === "note") {
      addNote({
        content: trimmedContent,
        ...linkedData,
      });
    }

    if (captureMode === "todo") {
      addTodo({
        content: trimmedContent,
        ...linkedData,
      });
    }

    setCaptureContent("");
  }
  
  function handleOpenLinkedVideo(videoId: string, timestamp = 0) {
    const linkedVideo = videos.find((video) => video.id === videoId);

    if (!linkedVideo) return;

    setActiveContext({
      entityId: linkedVideo.id,
      entityType: linkedVideo.type,
      title: linkedVideo.title,
      timestamp,
    });
  }

  function handleStartEditNote(noteId: string, title: string, content: string) {
    setEditingNoteId(noteId);
    setEditingNoteContent([title, content].filter(Boolean).join("\n"));
  }

  function handleCancelEditNote() {
    setEditingNoteId(null);
    setEditingNoteContent("");
  }

  function handleSaveEditNote(noteId: string) {
    updateNote(noteId, editingNoteContent);
    setEditingNoteId(null);
    setEditingNoteContent("");
  }

  function handleDeleteNote(noteId: string) {
    const confirmed = window.confirm("Delete this note?");

    if (!confirmed) return;

    deleteNote(noteId);
  }

  function handleClearNotes() {
    const confirmed = window.confirm("Clear all notes?");

    if (!confirmed) return;

    clearNotes();
  }
  
  function renderNoteCard(note: (typeof notes)[number]) {
    const isCurrentContextNote = note.linkedEntityId === activeContext?.entityId;
    const isExpanded = isNoteExpanded(note.id);
    const hasLongContent = shouldCollapseNote(note.content);

    return (
      <div
        key={note.id}
        className={`rounded-xl border p-3 transition ${
          isCurrentContextNote
            ? "border-neutral-700 bg-neutral-900"
            : "border-neutral-800 bg-neutral-900"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center text-neutral-400">
            <StickyNote size={16} />
          </div>

          <div className="min-w-0 flex-1">
            {editingNoteId === note.id ? (
              <div>
                <textarea
                  value={editingNoteContent}
                  onChange={(event) => setEditingNoteContent(event.target.value)}
                  className="h-28 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-sm text-neutral-200 outline-none placeholder:text-neutral-600 focus:border-neutral-600"
                  placeholder="Title\nWrite your note here..."
                />

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={handleCancelEditNote}
                    className="rounded-lg border border-neutral-800 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={() => handleSaveEditNote(note.id)}
                    className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-950 hover:bg-neutral-200"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold leading-5 text-neutral-100">
                  {note.title}
                </p>

                {note.content ? (
                  <>
                    <div
                      className={`mt-2 text-sm leading-6 text-neutral-300 ${
                        !isExpanded && hasLongContent ? "line-clamp-5" : ""
                      }`}
                    >
                      {note.content}
                    </div>

                    {hasLongContent && (
                      <button
                        onClick={() => toggleExpandedNote(note.id)}
                        className="mt-2 text-xs text-neutral-400 hover:text-white"
                      >
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-xs text-neutral-600">
                    No additional content
                  </p>
                )}

                {note.linkedEntityId ? (
                  <p className="mt-3 line-clamp-2 text-xs text-neutral-500">
                    From{" "}
                    <span className="text-neutral-300">
                      {note.linkedEntityTitle ?? "Untitled"}
                    </span>
                    {typeof note.timestamp === "number" && (
                      <span> · {formatTime(note.timestamp)}</span>
                    )}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-neutral-600">
                    No linked context
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div>
                    {isCurrentContextNote && (
                      <span className="rounded-full bg-neutral-800 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-neutral-400">
                        Current
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {note.linkedEntityType === "video" && note.linkedEntityId && (
                      <button
                        onClick={() =>
                          handleOpenLinkedVideo(
                            note.linkedEntityId!,
                            note.timestamp ?? 0,
                          )
                        }
                        className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
                      >
                        Open
                      </button>
                    )}

                    <button
                      onClick={() =>
                        handleStartEditNote(note.id, note.title, note.content)
                      }
                      className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white"
                    >
                      Edit
                    </button>

                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      className="rounded-lg border border-neutral-800 p-1 text-neutral-500 hover:bg-neutral-800 hover:text-white"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  function toggleExpandedNote(noteId: string) {
    setExpandedNoteIds((current) =>
      current.includes(noteId)
        ? current.filter((id) => id !== noteId)
        : [...current, noteId],
    );
  }

  function isNoteExpanded(noteId: string) {
    return expandedNoteIds.includes(noteId);
  }

  function shouldCollapseNote(content: string) {
    return content.length > 180 || content.split("\n").length > 4;
  }

  return (
    <>
  <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h4 className="text-sm font-medium text-neutral-300">
          Quick Capture
        </h4>
        <p className="mt-1 text-xs text-neutral-500">
          Capture a note or todo for the current context.
        </p>
      </div>

      {activeContext && (
        <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-500">
          {formatTime(activeContext.timestamp)}
        </span>
      )}
    </div>

    <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-neutral-800 bg-neutral-900 p-1">
      <button
        onClick={() => setCaptureMode("note")}
        className={`rounded-xl px-3 py-2 text-sm transition ${
          captureMode === "note"
            ? "bg-white text-neutral-950"
            : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
        }`}
      >
        Note
      </button>

      <button
        onClick={() => setCaptureMode("todo")}
        className={`rounded-xl px-3 py-2 text-sm transition ${
          captureMode === "todo"
            ? "bg-white text-neutral-950"
            : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
        }`}
      >
        Todo
      </button>
    </div>

    <textarea
      value={captureContent}
      onChange={(event) => setCaptureContent(event.target.value)}
      className="mt-3 h-40 w-full resize-none rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm outline-none placeholder:text-neutral-600 focus:border-neutral-600"
      placeholder={
        captureMode === "note"
          ? "Title\nWrite your note here..."
          : "Todo title\nTask 1\nTask 2\nTask 3"
      }
    />

    <button
      onClick={handleSaveCapture}
      className="mt-3 w-full rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
    >
      {captureMode === "note" ? "Save Note" : "Add Todo"}
    </button>
  </div>

<div className="mt-4 rounded-2xl border border-neutral-800 bg-neutral-950 p-4">
  <div className="flex items-center justify-between gap-3">
    <h4 className="font-medium">Notes</h4>

    {notes.length > 0 && (
      <button
        onClick={handleClearNotes}
        className="rounded-lg border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-900 hover:text-white"
      >
        Clear
      </button>
    )}
  </div>
  
  {notes.length === 0 ? (
    <p className="mt-2 text-sm text-neutral-500">No notes yet.</p>
  ) : (
    <div className="mt-4 space-y-5">
      {activeContext && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h5 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
              Current Video Notes
            </h5>

            <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-500">
              {currentContextNotes.length}
            </span>
          </div>

          {currentContextNotes.length === 0 ? (
            <p className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
              No notes for this video yet.
            </p>
          ) : (
            <div className="space-y-3">
              {currentContextNotes.map((note) => renderNoteCard(note))}
            </div>
          )}
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h5 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
            Other Notes
          </h5>

          <span className="rounded-full bg-neutral-900 px-2 py-1 text-xs text-neutral-500">
            {otherNotes.length}
          </span>
        </div>

        {otherNotes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-neutral-800 bg-neutral-900 p-3 text-sm text-neutral-500">
            No other notes.
          </p>
        ) : (
          <div className="space-y-3">
            {otherNotes.map((note) => renderNoteCard(note))}
          </div>
        )}
      </section>
    </div>
  )}
</div>
    </>
  );
}