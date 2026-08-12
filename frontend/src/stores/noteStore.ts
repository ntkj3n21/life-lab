import { create } from "zustand";

import { ApiError } from "../lib/api";

import {
  createNote as createNoteRequest,
  deleteNote as deleteNoteRequest,
  getNoteDeleteImpact,
  getNotes,
  getVideoNotes,
  updateNote as updateNoteRequest,
  type CreateNoteInput,
  type Note,
  type NoteDeleteImpact,
  type NoteQuery,
} from "../modules/notes/services/noteApi";

interface NoteStore {
  notes: Note[];

  videoNotes: Record<
    number,
    Note[]
  >;

  page: number;
  size: number;
  totalElements: number;
  totalPages: number;

  isLoading: boolean;
  isMutating: boolean;

  error: ApiError | null;

  loadNotes: (
    query?: NoteQuery,
  ) => Promise<void>;

  loadVideoNotes: (
    libraryVideoId: number,
  ) => Promise<Note[]>;

  createNote: (
    libraryVideoId: number,
    input: CreateNoteInput,
  ) => Promise<Note>;

  updateNote: (
    noteId: number,
    content: string,
  ) => Promise<Note>;

  getDeleteImpact: (
    noteId: number,
  ) => Promise<NoteDeleteImpact>;

  deleteNote: (
    noteId: number,
  ) => Promise<void>;

  clearError: () => void;
  reset: () => void;
}

function toApiError(
  error: unknown,
) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(0, {
    code: "UNKNOWN_ERROR",
    message:
      "Something went wrong.",
    fieldErrors: {},
  });
}

const initialState = {
  notes: [] as Note[],

  videoNotes: {} as Record<
    number,
    Note[]
  >,

  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,

  isLoading: false,
  isMutating: false,

  error: null as ApiError | null,
};

function replaceNote(
  notes: Note[],
  updatedNote: Note,
) {
  return notes.map((note) =>
    note.id === updatedNote.id
      ? updatedNote
      : note,
  );
}

export const useNoteStore =
  create<NoteStore>(
    (set) => ({
      ...initialState,

      loadNotes: async (
        query = {},
      ) => {
        set({
          isLoading: true,
          error: null,
        });

        try {
          const response =
            await getNotes({
              page: 0,
              size: 20,
              ...query,
            });

          set({
            notes:
              response.items,
            page:
              response.page,
            size:
              response.size,
            totalElements:
              response.totalElements,
            totalPages:
              response.totalPages,
          });
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            error: apiError,
          });

          throw apiError;
        } finally {
          set({
            isLoading: false,
          });
        }
      },

      loadVideoNotes:
        async (
          libraryVideoId,
        ) => {
          try {
            const notes =
              await getVideoNotes(
                libraryVideoId,
              );

            set((state) => ({
              videoNotes: {
                ...state.videoNotes,
                [libraryVideoId]:
                  notes,
              },
              error: null,
            }));

            return notes;
          } catch (error) {
            const apiError =
              toApiError(error);

            set({
              error: apiError,
            });

            throw apiError;
          }
        },

      createNote: async (
        libraryVideoId,
        input,
      ) => {
        set({
          isMutating: true,
          error: null,
        });

        try {
          const note =
            await createNoteRequest(
              libraryVideoId,
              input,
            );

          set((state) => ({
            notes: [
              note,
              ...state.notes.filter(
                (existing) =>
                  existing.id !==
                  note.id,
              ),
            ],

            videoNotes: {
              ...state.videoNotes,

              [libraryVideoId]: [
                ...(
                  state.videoNotes[
                    libraryVideoId
                  ] ?? []
                ).filter(
                  (existing) =>
                    existing.id !==
                    note.id,
                ),
                note,
              ].sort(
                (a, b) => {
                  if (
                    a.timestampSeconds ===
                      null &&
                    b.timestampSeconds !==
                      null
                  ) {
                    return 1;
                  }

                  if (
                    a.timestampSeconds !==
                      null &&
                    b.timestampSeconds ===
                      null
                  ) {
                    return -1;
                  }

                  if (
                    a.timestampSeconds !==
                      null &&
                    b.timestampSeconds !==
                      null &&
                    a.timestampSeconds !==
                      b.timestampSeconds
                  ) {
                    return (
                      a.timestampSeconds -
                      b.timestampSeconds
                    );
                  }

                  return (
                    new Date(
                      b.createdAt,
                    ).getTime() -
                    new Date(
                      a.createdAt,
                    ).getTime()
                  );
                },
              ),
            },

            totalElements:
              state.totalElements +
              1,
          }));

          return note;
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            error: apiError,
          });

          throw apiError;
        } finally {
          set({
            isMutating: false,
          });
        }
      },

      updateNote: async (
        noteId,
        content,
      ) => {
        set({
          isMutating: true,
          error: null,
        });

        try {
          const note =
            await updateNoteRequest(
              noteId,
              {
                content:
                  content.trim(),
              },
            );

          set((state) => {
            const nextVideoNotes =
              Object.fromEntries(
                Object.entries(
                  state.videoNotes,
                ).map(
                  ([
                    videoId,
                    notes,
                  ]) => [
                    videoId,
                    replaceNote(
                      notes,
                      note,
                    ),
                  ],
                ),
              ) as Record<
                number,
                Note[]
              >;

            return {
              notes:
                replaceNote(
                  state.notes,
                  note,
                ),

              videoNotes:
                nextVideoNotes,
            };
          });

          return note;
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            error: apiError,
          });

          throw apiError;
        } finally {
          set({
            isMutating: false,
          });
        }
      },

      getDeleteImpact:
        async (noteId) => {
          try {
            const impact =
              await getNoteDeleteImpact(
                noteId,
              );

            set({
              error: null,
            });

            return impact;
          } catch (error) {
            const apiError =
              toApiError(error);

            set({
              error: apiError,
            });

            throw apiError;
          }
        },

      deleteNote: async (
        noteId,
      ) => {
        set({
          isMutating: true,
          error: null,
        });

        try {
          await deleteNoteRequest(
            noteId,
          );

          set((state) => {
            const nextVideoNotes =
              Object.fromEntries(
                Object.entries(
                  state.videoNotes,
                ).map(
                  ([
                    videoId,
                    notes,
                  ]) => [
                    videoId,
                    notes.filter(
                      (note) =>
                        note.id !==
                        noteId,
                    ),
                  ],
                ),
              ) as Record<
                number,
                Note[]
              >;

            return {
              notes:
                state.notes.filter(
                  (note) =>
                    note.id !==
                    noteId,
                ),

              videoNotes:
                nextVideoNotes,

              totalElements:
                Math.max(
                  0,
                  state.totalElements -
                    1,
                ),
            };
          });
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            error: apiError,
          });

          throw apiError;
        } finally {
          set({
            isMutating: false,
          });
        }
      },

      clearError: () => {
        set({
          error: null,
        });
      },

      reset: () => {
        set({
          ...initialState,
        });
      },
    }),
  );