import {
  ArrowLeft,
  ExternalLink,
  LoaderCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useState,
} from "react";
import {
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import { ApiError } from "../../../lib/api";
import { formatTime } from "../../../utils/formatTime";
import {
  useReverseContextNavigation,
} from "../../context/hooks/useReverseContextNavigation";
import {
  deleteNote,
  getNote,
  getNoteDeleteImpact,
  updateNote,
  type Note,
  type NoteDeleteImpact,
} from "../services/noteApi";

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong.";
}

function formatDateTime(
  value: string,
) {
  const parsed = new Date(value);

  if (
    Number.isNaN(
      parsed.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(parsed);
}

export function NoteDetailPage() {
  const navigate = useNavigate();
  const { noteId } = useParams();

  const parsedNoteId =
    Number(noteId);

  const isValidNoteId =
    Number.isSafeInteger(
      parsedNoteId,
    ) &&
    parsedNoteId > 0;

  const {
    openNoteContext,
  } =
    useReverseContextNavigation();

  const [
    note,
    setNote,
  ] = useState<Note | null>(
    null,
  );

  const [
    isLoading,
    setIsLoading,
  ] = useState(
    isValidNoteId,
  );

  const [
    isMutating,
    setIsMutating,
  ] = useState(false);

  const [
    isEditing,
    setIsEditing,
  ] = useState(false);

  const [
    editingContent,
    setEditingContent,
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    deleteImpact,
    setDeleteImpact,
  ] =
    useState<NoteDeleteImpact | null>(
      null,
    );

  const [
    deleteErrorMessage,
    setDeleteErrorMessage,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!isValidNoteId) {
      return;
    }

    let cancelled = false;

    void getNote(parsedNoteId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setNote(response);
        setEditingContent(
          response.content,
        );
        setErrorMessage(null);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          getErrorMessage(error),
        );
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isValidNoteId,
    parsedNoteId,
  ]);

  if (!isValidNoteId) {
    return (
      <Navigate
        to="/notes"
        replace
      />
    );
  }

  async function handleSave() {
    const content =
      editingContent.trim();

    if (
      !note ||
      isMutating ||
      !content
    ) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const updated =
        await updateNote(
          note.id,
          {
            content,
          },
        );

      setNote(updated);
      setEditingContent(
        updated.content,
      );
      setIsEditing(false);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleOpenDelete() {
    if (
      !note ||
      isMutating
    ) {
      return;
    }

    setDeleteErrorMessage(null);

    try {
      const impact =
        await getNoteDeleteImpact(
          note.id,
        );

      setDeleteImpact(impact);
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    }
  }

  async function handleDelete() {
    if (
      !note ||
      !deleteImpact ||
      isMutating
    ) {
      return;
    }

    setIsMutating(true);
    setDeleteErrorMessage(null);

    try {
      await deleteNote(note.id);

      navigate("/notes", {
        replace: true,
      });
    } catch (error) {
      setDeleteErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleViewSource() {
    if (!note) {
      return;
    }

    setErrorMessage(null);

    try {
      await openNoteContext(
        note.id,
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    }
  }

  const sourceTitle =
    note?.youtubeSource.title ??
    note?.youtubeSource.youtubeVideoId ??
    "";

  const deleteDetails =
    deleteImpact
      ? [
          `${deleteImpact.taskCountToMarkSourceMissing} linked Task(s) will remain and become SOURCE_MISSING.`,
          deleteImpact.youtubeSourcePreserved
            ? "The exact YouTube source record will be preserved."
            : "The YouTube source will not be preserved.",
          deleteImpact.tasksPreserved
            ? "Linked Tasks are preserved."
            : "Linked Tasks are not preserved.",
        ]
      : [];

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <button
          type="button"
          onClick={() =>
            navigate("/notes")
          }
          className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700"
        >
          <ArrowLeft
            size={15}
            aria-hidden="true"
          />
          Back to Notes
        </button>

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex min-h-64 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900"
          >
            <div className="text-center">
              <LoaderCircle
                size={24}
                className="mx-auto animate-spin text-neutral-500"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm text-neutral-500">
                Loading Note...
              </p>
            </div>
          </div>
        ) : errorMessage &&
          !note ? (
          <div
            role="alert"
            className="mt-6 rounded-2xl border border-red-900/60 bg-red-950/30 p-5"
          >
            <h1 className="text-lg font-semibold text-red-200">
              Could not load Note
            </h1>

            <p className="mt-2 text-sm text-red-300/80">
              {errorMessage}
            </p>
          </div>
        ) : note ? (
          <>
            <header className="mt-6">
              <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">
                Note detail
              </p>

              <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h1 className="wrap-break-word text-2xl font-semibold">
                    {sourceTitle}
                  </h1>

                  {note.youtubeSource
                    .channelName && (
                    <p className="mt-1 text-sm text-neutral-500">
                      {
                        note.youtubeSource
                          .channelName
                      }
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void handleViewSource()
                    }
                    disabled={isMutating}
                    className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ExternalLink
                      size={14}
                      aria-hidden="true"
                    />
                    View Source
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingContent(
                        note.content,
                      );
                      setIsEditing(true);
                    }}
                    disabled={
                      isMutating ||
                      isEditing
                    }
                    className="flex items-center gap-2 rounded-xl border border-neutral-800 px-3 py-2 text-sm text-neutral-300 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Pencil
                      size={14}
                      aria-hidden="true"
                    />
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void handleOpenDelete()
                    }
                    disabled={isMutating}
                    className="flex items-center gap-2 rounded-xl border border-red-950/70 px-3 py-2 text-sm text-red-300 transition hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-900 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2
                      size={14}
                      aria-hidden="true"
                    />
                    Delete
                  </button>
                </div>
              </div>
            </header>

            {errorMessage && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300"
              >
                {errorMessage}
              </div>
            )}

            <section className="mt-6 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Timestamp
                  </p>

                  <p className="mt-1 text-sm text-neutral-300">
                    {note.timestampSeconds !==
                    null
                      ? formatTime(
                          note.timestampSeconds,
                        )
                      : "Not recorded"}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    YouTube source
                  </p>

                  <p
                    className="mt-1 truncate text-sm text-neutral-300"
                    title={
                      note.youtubeSource
                        .youtubeVideoId
                    }
                  >
                    {
                      note.youtubeSource
                        .youtubeVideoId
                    }
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Created
                  </p>

                  <p className="mt-1 text-sm text-neutral-300">
                    {formatDateTime(
                      note.createdAt,
                    )}
                  </p>
                </div>

                <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-600">
                    Updated
                  </p>

                  <p className="mt-1 text-sm text-neutral-300">
                    {formatDateTime(
                      note.updatedAt,
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-5">
                <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">
                  Content
                </p>

                {isEditing ? (
                  <>
                    <label
                      htmlFor="note-detail-content"
                      className="sr-only"
                    >
                      Note content
                    </label>

                    <textarea
                      id="note-detail-content"
                      value={
                        editingContent
                      }
                      disabled={
                        isMutating
                      }
                      onChange={(event) =>
                        setEditingContent(
                          event.target.value,
                        )
                      }
                      className="mt-3 min-h-48 w-full resize-y rounded-xl border border-neutral-800 bg-neutral-950 p-4 text-sm leading-6 text-neutral-200 outline-none focus:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
                    />

                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingContent(
                            note.content,
                          );
                          setIsEditing(
                            false,
                          );
                        }}
                        disabled={
                          isMutating
                        }
                        className="rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-400 transition hover:bg-neutral-950 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void handleSave()
                        }
                        disabled={
                          isMutating ||
                          !editingContent.trim()
                        }
                        className="rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isMutating
                          ? "Saving..."
                          : "Save"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 whitespace-pre-wrap wrap-break-word text-sm leading-7 text-neutral-300">
                    {note.content}
                  </p>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <ConfirmDialog
        open={
          deleteImpact !== null
        }
        title="Delete this Note?"
        description="Deleting a Note does not delete Tasks created from it. Those Tasks are preserved but their original source becomes unavailable."
        details={deleteDetails}
        confirmLabel="Delete Note"
        isBusy={isMutating}
        errorMessage={
          deleteErrorMessage
        }
        onCancel={() => {
          if (isMutating) {
            return;
          }

          setDeleteImpact(null);
          setDeleteErrorMessage(
            null,
          );
        }}
        onConfirm={
          handleDelete
        }
      />
    </main>
  );
}