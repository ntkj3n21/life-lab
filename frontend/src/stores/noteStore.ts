import { create } from "zustand";

import { ApiError } from "../lib/api";

import {
  createAudioNote,
  createImageNote,
  createNote as createNoteRequest,
  deleteNote as deleteNoteRequest,
  getAudioNotes,
  getImageNotes,
  getNoteDeleteImpact,
  getNotes,
  getVideoNotes,
  updateNote as updateNoteRequest,
  type CreateNoteInput,
  type Note,
  type NoteDeleteImpact,
  type NoteQuery,
} from "../modules/notes/services/noteApi";
import type { EntityType } from "../types/lifeLab";

type LoadStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

export interface WorkspaceNoteSource {
  entityType: EntityType;
  libraryId: number;
}

export function getWorkspaceNoteKey(
  source: WorkspaceNoteSource,
) {
  return `${source.entityType}:${source.libraryId}`;
}

interface NoteStore {
  notes: Note[];

  videoNotes: Record<
    number,
    Note[]
  >;
  workspaceNotes: Record<string, Note[]>;

  page: number;
  size: number;
  totalElements: number;
  totalPages: number;

  isLoading: boolean;
  isMutating: boolean;

  error: ApiError | null;
  notesLoadStatus: LoadStatus;
  notesLoadError: ApiError | null;
  videoNotesLoadStatus: Record<
    number,
    LoadStatus
  >;
  videoNotesLoadErrors: Record<
    number,
    ApiError | null
  >;
  workspaceNotesLoadStatus: Record<
    string,
    LoadStatus
  >;
  workspaceNotesLoadErrors: Record<
    string,
    ApiError | null
  >;

  loadNotes: (
    query?: NoteQuery,
  ) => Promise<void>;

  loadVideoNotes: (
    libraryVideoId: number,
  ) => Promise<Note[]>;

  loadWorkspaceNotes: (
    source: WorkspaceNoteSource,
  ) => Promise<Note[]>;

  createNote: (
    libraryVideoId: number,
    input: CreateNoteInput,
  ) => Promise<Note>;

  createWorkspaceNote: (
    source: WorkspaceNoteSource,
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
  workspaceNotes: {} as Record<
    string,
    Note[]
  >,

  page: 0,
  size: 20,
  totalElements: 0,
  totalPages: 0,

  isLoading: false,
  isMutating: false,

  error: null as ApiError | null,
  notesLoadStatus:
    "idle" as LoadStatus,
  notesLoadError:
    null as ApiError | null,
  videoNotesLoadStatus: {} as Record<
    number,
    LoadStatus
  >,
  videoNotesLoadErrors: {} as Record<
    number,
    ApiError | null
  >,
  workspaceNotesLoadStatus: {} as Record<
    string,
    LoadStatus
  >,
  workspaceNotesLoadErrors: {} as Record<
    string,
    ApiError | null
  >,
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

function sortWorkspaceNotes(
  entityType: EntityType,
  notes: Note[],
) {
  if (entityType === "image") {
    return [...notes].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() -
        new Date(a.createdAt).getTime(),
    );
  }

  return [...notes].sort((a, b) => {
    if (
      a.timestampSeconds === null &&
      b.timestampSeconds !== null
    ) {
      return 1;
    }

    if (
      a.timestampSeconds !== null &&
      b.timestampSeconds === null
    ) {
      return -1;
    }

    if (
      a.timestampSeconds !== null &&
      b.timestampSeconds !== null &&
      a.timestampSeconds !== b.timestampSeconds
    ) {
      return (
        a.timestampSeconds -
        b.timestampSeconds
      );
    }

    return (
      new Date(b.createdAt).getTime() -
      new Date(a.createdAt).getTime()
    );
  });
}

function requestWorkspaceNotes(
  source: WorkspaceNoteSource,
) {
  switch (source.entityType) {
    case "image":
      return getImageNotes(source.libraryId);
    case "audio":
      return getAudioNotes(source.libraryId);
    case "video":
      return getVideoNotes(source.libraryId);
  }
}

function createWorkspaceNoteRequest(
  source: WorkspaceNoteSource,
  input: CreateNoteInput,
) {
  switch (source.entityType) {
    case "image":
      return createImageNote(source.libraryId, {
        content: input.content,
      });
    case "audio":
      return createAudioNote(source.libraryId, input);
    case "video":
      return createNoteRequest(source.libraryId, input);
  }
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
          notesLoadStatus:
            "loading",
          notesLoadError: null,
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
            notesLoadStatus:
              "success",
            notesLoadError:
              null,
          });
        } catch (error) {
          const apiError =
            toApiError(error);

          set({
            notesLoadStatus:
              "error",
            notesLoadError:
              apiError,
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
          set((state) => ({
            videoNotesLoadStatus: {
              ...state.videoNotesLoadStatus,
              [libraryVideoId]:
                "loading",
            },
            videoNotesLoadErrors: {
              ...state.videoNotesLoadErrors,
              [libraryVideoId]:
                null,
            },
          }));

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
              workspaceNotes: {
                ...state.workspaceNotes,
                [`video:${libraryVideoId}`]: notes,
              },
              videoNotesLoadStatus: {
                ...state.videoNotesLoadStatus,
                [libraryVideoId]:
                  "success",
              },
              videoNotesLoadErrors: {
                ...state.videoNotesLoadErrors,
                [libraryVideoId]:
                  null,
              },
            }));

            return notes;
          } catch (error) {
            const apiError =
              toApiError(error);

            set((state) => ({
              videoNotesLoadStatus: {
                ...state.videoNotesLoadStatus,
                [libraryVideoId]:
                  "error",
              },
              videoNotesLoadErrors: {
                ...state.videoNotesLoadErrors,
                [libraryVideoId]:
                  apiError,
              },
            }));

            throw apiError;
          }
        },

      loadWorkspaceNotes:
        async (source) => {
          const key =
            getWorkspaceNoteKey(source);

          set((state) => ({
            workspaceNotesLoadStatus: {
              ...state.workspaceNotesLoadStatus,
              [key]: "loading",
            },
            workspaceNotesLoadErrors: {
              ...state.workspaceNotesLoadErrors,
              [key]: null,
            },
          }));

          try {
            const notes =
              await requestWorkspaceNotes(source);

            set((state) => ({
              workspaceNotes: {
                ...state.workspaceNotes,
                [key]: notes,
              },
              workspaceNotesLoadStatus: {
                ...state.workspaceNotesLoadStatus,
                [key]: "success",
              },
              workspaceNotesLoadErrors: {
                ...state.workspaceNotesLoadErrors,
                [key]: null,
              },
              ...(source.entityType === "video"
                ? {
                    videoNotes: {
                      ...state.videoNotes,
                      [source.libraryId]: notes,
                    },
                    videoNotesLoadStatus: {
                      ...state.videoNotesLoadStatus,
                      [source.libraryId]: "success" as const,
                    },
                    videoNotesLoadErrors: {
                      ...state.videoNotesLoadErrors,
                      [source.libraryId]: null,
                    },
                  }
                : {}),
            }));

            return notes;
          } catch (error) {
            const apiError = toApiError(error);

            set((state) => ({
              workspaceNotesLoadStatus: {
                ...state.workspaceNotesLoadStatus,
                [key]: "error",
              },
              workspaceNotesLoadErrors: {
                ...state.workspaceNotesLoadErrors,
                [key]: apiError,
              },
            }));

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

            workspaceNotes: {
              ...state.workspaceNotes,
              [`video:${libraryVideoId}`]:
                sortWorkspaceNotes(
                  "video",
                  [
                    ...(state.workspaceNotes[
                      `video:${libraryVideoId}`
                    ] ?? []).filter(
                      (existing) =>
                        existing.id !== note.id,
                    ),
                    note,
                  ],
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
            const nextWorkspaceNotes =
              Object.fromEntries(
                Object.entries(
                  state.workspaceNotes,
                ).map(([key, notes]) => [
                  key,
                  replaceNote(notes, note),
                ]),
              ) as Record<string, Note[]>;

            return {
              notes:
                replaceNote(
                  state.notes,
                  note,
                ),

              videoNotes:
                nextVideoNotes,
              workspaceNotes:
                nextWorkspaceNotes,
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

      createWorkspaceNote:
        async (source, input) => {
          set({
            isMutating: true,
            error: null,
          });

          try {
            const note =
              await createWorkspaceNoteRequest(
                source,
                input,
              );
            const key =
              getWorkspaceNoteKey(source);

            set((state) => {
              const sourceNotes =
                sortWorkspaceNotes(
                  source.entityType,
                  [
                    ...(state.workspaceNotes[key] ?? []).filter(
                      (existing) =>
                        existing.id !== note.id,
                    ),
                    note,
                  ],
                );

              return {
                notes: [
                  note,
                  ...state.notes.filter(
                    (existing) =>
                      existing.id !== note.id,
                  ),
                ],
                workspaceNotes: {
                  ...state.workspaceNotes,
                  [key]: sourceNotes,
                },
                ...(source.entityType === "video"
                  ? {
                      videoNotes: {
                        ...state.videoNotes,
                        [source.libraryId]: sourceNotes,
                      },
                    }
                  : {}),
                totalElements:
                  state.totalElements + 1,
              };
            });

            return note;
          } catch (error) {
            const apiError = toApiError(error);

            set({ error: apiError });
            throw apiError;
          } finally {
            set({ isMutating: false });
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
            const nextWorkspaceNotes =
              Object.fromEntries(
                Object.entries(
                  state.workspaceNotes,
                ).map(([key, notes]) => [
                  key,
                  notes.filter(
                    (note) => note.id !== noteId,
                  ),
                ]),
              ) as Record<string, Note[]>;

            return {
              notes:
                state.notes.filter(
                  (note) =>
                    note.id !==
                    noteId,
                ),

              videoNotes:
                nextVideoNotes,
              workspaceNotes:
                nextWorkspaceNotes,

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
