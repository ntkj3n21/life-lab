import {
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Search,
  StickyNote,
} from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

import { ConfirmDialog } from "../../../components/ui/ConfirmDialog";
import {
  ApiError,
} from "../../../lib/api";
import {
  useReverseContextNavigation,
} from "../../context/hooks/useReverseContextNavigation";
import {
  deleteNote as deleteNoteRequest,
  getNoteDeleteImpact,
  getNotes,
  updateNote as updateNoteRequest,
  type Note,
  type NoteDeleteImpact,
} from "../services/noteApi";
import { NoteCard } from "../components/NoteCard";

interface PendingNoteDelete {
  note: Note;
  impact: NoteDeleteImpact;
}

const PAGE_SIZE = 20;

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  return "Something went wrong.";
}

export function NotesPage() {
  const navigate = useNavigate();

  const {
    openNoteContext,
  } =
    useReverseContextNavigation();

  const [
    notes,
    setNotes,
  ] = useState<Note[]>([]);

  const [
    page,
    setPage,
  ] = useState(0);

  const [
    totalElements,
    setTotalElements,
  ] = useState(0);

  const [
    totalPages,
    setTotalPages,
  ] = useState(0);

  const [
    searchText,
    setSearchText,
  ] = useState("");

  const [
    appliedQuery,
    setAppliedQuery,
  ] = useState("");

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    isMutating,
    setIsMutating,
  ] = useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState<string | null>(
    null,
  );

  const [
    editingNoteId,
    setEditingNoteId,
  ] = useState<number | null>(
    null,
  );

  const [
    editingContent,
    setEditingContent,
  ] = useState("");

  const [
    pendingDelete,
    setPendingDelete,
  ] =
    useState<PendingNoteDelete | null>(
      null,
    );

  const [
    deleteErrorMessage,
    setDeleteErrorMessage,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;

    void getNotes({
      page,
      size: PAGE_SIZE,
      q:
        appliedQuery ||
        undefined,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setNotes(response.items);
        setTotalElements(
          response.totalElements,
        );
        setTotalPages(
          response.totalPages,
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
    page,
    appliedQuery,
  ]);

  async function reloadNotesAfterMutation(
    preferredPage: number,
  ) {
    const targetPage =
      Math.max(0, preferredPage);

    const response =
      await getNotes({
        page: targetPage,
        size: PAGE_SIZE,
        q:
          appliedQuery ||
          undefined,
      });

    const normalizedPage =
      response.totalPages === 0
        ? 0
        : Math.min(
            targetPage,
            response.totalPages - 1,
          );

    /*
     * Editing can make a Note leave the current
     * search result, and deletion can remove the
     * final item from the final page. When the
     * current page becomes invalid, move to the
     * new last page and let the normal effect load
     * that page exactly once.
     */
    if (
      normalizedPage !==
      targetPage
    ) {
      setIsLoading(true);
      setPage(normalizedPage);
      return;
    }

    setNotes(response.items);
    setTotalElements(
      response.totalElements,
    );
    setTotalPages(
      response.totalPages,
    );
  }

  async function reloadSameSearch(
    query: string,
  ) {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response =
        await getNotes({
          page: 0,
          size: PAGE_SIZE,
          q:
            query ||
            undefined,
        });

      setNotes(response.items);
      setTotalElements(
        response.totalElements,
      );
      setTotalPages(
        response.totalPages,
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleSearchSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const nextQuery =
      searchText.trim();

    setErrorMessage(null);

    /*
     * React does not rerun the data-loading effect
     * when both page and appliedQuery keep the same
     * values. Reload explicitly in that case instead
     * of setting isLoading and leaving the page stuck.
     */
    if (
      page === 0 &&
      nextQuery === appliedQuery
    ) {
      void reloadSameSearch(
        nextQuery,
      );
      return;
    }

    setIsLoading(true);

    if (page !== 0) {
      setPage(0);
    }

    setAppliedQuery(nextQuery);
  }

  function handleClearSearch() {
    setSearchText("");
    setErrorMessage(null);

    if (
      page === 0 &&
      appliedQuery === ""
    ) {
      return;
    }

    setIsLoading(true);

    if (page !== 0) {
      setPage(0);
    }

    setAppliedQuery("");
  }

  function handlePageChange(
    nextPage: number,
  ) {
    if (
      isLoading ||
      nextPage < 0 ||
      nextPage >= totalPages ||
      nextPage === page
    ) {
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setPage(nextPage);
  }

  function handleStartEdit(
    note: Note,
  ) {
    setEditingNoteId(note.id);
    setEditingContent(
      note.content,
    );
    setErrorMessage(null);
  }

  function handleCancelEdit() {
    setEditingNoteId(null);
    setEditingContent("");
  }

  async function handleSaveEdit(
    noteId: number,
  ) {
    const content =
      editingContent.trim();

    if (
      isMutating ||
      !content
    ) {
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);

    try {
      await updateNoteRequest(
        noteId,
        {
          content,
        },
      );

      setEditingNoteId(null);
      setEditingContent("");

      await reloadNotesAfterMutation(
        page,
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleRequestDelete(
    note: Note,
  ) {
    if (isMutating) {
      return;
    }

    setDeleteErrorMessage(null);

    try {
      const impact =
        await getNoteDeleteImpact(
          note.id,
        );

      setPendingDelete({
        note,
        impact,
      });
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    }
  }

  async function handleConfirmDelete() {
    if (
      !pendingDelete ||
      isMutating
    ) {
      return;
    }

    setIsMutating(true);
    setDeleteErrorMessage(null);
    setErrorMessage(null);

    try {
      await deleteNoteRequest(
        pendingDelete.note.id,
      );

      if (
        editingNoteId ===
        pendingDelete.note.id
      ) {
        handleCancelEdit();
      }

      setPendingDelete(null);

      try {
        await reloadNotesAfterMutation(
          page,
        );
      } catch (error) {
        /*
         * The Note is already deleted at this point.
         * Report a list-refresh problem globally
         * instead of reopening a destructive action.
         */
        setErrorMessage(
          getErrorMessage(error),
        );
      }
    } catch (error) {
      setDeleteErrorMessage(
        getErrorMessage(error),
      );
    } finally {
      setIsMutating(false);
    }
  }

  async function handleViewSource(
    noteId: number,
  ) {
    setErrorMessage(null);

    try {
      await openNoteContext(
        noteId,
      );
    } catch (error) {
      setErrorMessage(
        getErrorMessage(error),
      );
    }
  }

  const hasSearch =
    Boolean(appliedQuery);

  const deleteDetails =
    pendingDelete
      ? [
          `${pendingDelete.impact.taskCountToMarkSourceMissing} linked Task(s) will remain, but their source status will become SOURCE_MISSING.`,
          pendingDelete.impact.youtubeSourcePreserved
            ? "The exact YouTube source record will be preserved."
            : "The YouTube source will not be preserved.",
          pendingDelete.impact.tasksPreserved
            ? "Linked Tasks are preserved."
            : "Linked Tasks are not preserved.",
        ]
      : [];

  return (
    <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-5xl">
        <header>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-600">
            Global workspace
          </p>

          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">
                Notes
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-400">
                Search and manage Notes across your account. Each Note keeps its exact YouTube source, and View Source uses the centralized Reverse Context flow.
              </p>
            </div>

            <p className="text-sm text-neutral-500">
              {totalElements} note
              {totalElements === 1
                ? ""
                : "s"}
            </p>
          </div>
        </header>

        <form
          onSubmit={
            handleSearchSubmit
          }
          className="mt-6 flex flex-col gap-2 sm:flex-row"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900 px-3 focus-within:border-neutral-600 focus-within:ring-2 focus-within:ring-neutral-700">
            <Search
              size={16}
              className="shrink-0 text-neutral-500"
              aria-hidden="true"
            />

            <label
              htmlFor="global-note-search"
              className="sr-only"
            >
              Search Notes
            </label>

            <input
              id="global-note-search"
              value={searchText}
              disabled={isLoading}
              onChange={(event) =>
                setSearchText(
                  event.target.value,
                )
              }
              placeholder="Search note content..."
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-neutral-600 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading && (
              <LoaderCircle
                size={14}
                className="animate-spin"
                aria-hidden="true"
              />
            )}

            Search
          </button>

          {(searchText ||
            hasSearch) && (
            <button
              type="button"
              disabled={isLoading}
              onClick={
                handleClearSearch
              }
              className="rounded-xl border border-neutral-800 px-4 py-2 text-sm text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          )}
        </form>

        {errorMessage && (
          <div
            role="alert"
            className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300"
          >
            {errorMessage}
          </div>
        )}

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-900"
          >
            <div className="text-center">
              <LoaderCircle
                size={24}
                className="mx-auto animate-spin text-neutral-500"
                aria-hidden="true"
              />

              <p className="mt-3 text-sm text-neutral-500">
                Loading Notes...
              </p>
            </div>
          </div>
        ) : notes.length === 0 ? (
          <div className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-neutral-950 p-6 text-center">
            <div>
              <StickyNote
                size={28}
                className="mx-auto text-neutral-700"
                aria-hidden="true"
              />

              <h2 className="mt-3 text-sm font-medium text-neutral-300">
                {hasSearch
                  ? "No matching Notes"
                  : "No Notes yet"}
              </h2>

              <p className="mt-2 max-w-md text-xs leading-5 text-neutral-500">
                {hasSearch
                  ? "No Note content matches the current keyword. Change or clear the search condition."
                  : "Notes created from a Video Workspace will appear here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-3">
            {notes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                current={false}
                isMutating={
                  isMutating
                }
                isEditing={
                  editingNoteId ===
                  note.id
                }
                editingContent={
                  editingNoteId ===
                  note.id
                    ? editingContent
                    : ""
                }
                onEditingContentChange={
                  setEditingContent
                }
                onStartEdit={
                  handleStartEdit
                }
                onCancelEdit={
                  handleCancelEdit
                }
                onSaveEdit={
                  handleSaveEdit
                }
                onDelete={
                  handleRequestDelete
                }
                onViewSource={
                  handleViewSource
                }
                onOpenDetail={(
                  noteId,
                ) =>
                  navigate(
                    `/notes/${noteId}`,
                  )
                }
              />
            ))}
          </div>
        )}

        {!isLoading &&
          totalPages > 1 && (
            <nav
              aria-label="Notes pagination"
              className="mt-6 flex items-center justify-between border-t border-neutral-800 pt-4"
            >
              <p className="text-xs text-neutral-500">
                Page {page + 1} of{" "}
                {totalPages}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    page <= 0 ||
                    isLoading
                  }
                  onClick={() =>
                    handlePageChange(
                      page - 1,
                    )
                  }
                  aria-label="Previous Notes page"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft
                    size={16}
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  disabled={
                    page + 1 >=
                      totalPages ||
                    isLoading
                  }
                  onClick={() =>
                    handlePageChange(
                      page + 1,
                    )
                  }
                  aria-label="Next Notes page"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 text-neutral-400 transition hover:bg-neutral-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight
                    size={16}
                    aria-hidden="true"
                  />
                </button>
              </div>
            </nav>
          )}
      </div>

      <ConfirmDialog
        open={
          pendingDelete !==
          null
        }
        title="Delete this Note?"
        description="This removes the Note itself. Life Lab preserves historical source integrity according to the Note deletion rules."
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

          setPendingDelete(null);
          setDeleteErrorMessage(
            null,
          );
        }}
        onConfirm={
          handleConfirmDelete
        }
      />
    </main>
  );
}