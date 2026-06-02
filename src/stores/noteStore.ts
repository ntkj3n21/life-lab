import { create } from "zustand";
import { nanoid } from "nanoid";
import type { EntityType, NoteItem } from "../types/lifeLab";

const NOTES_STORAGE_KEY = "life-lab-notes";

interface CreateNoteInput {
  content: string;
  linkedEntityId?: string;
  linkedEntityType?: EntityType;
  linkedEntityTitle?: string;
  timestamp?: number;
}

interface NoteStore {
  notes: NoteItem[];
  addNote: (input: CreateNoteInput) => void;
  updateNote: (noteId: string, content: string) => void;
  deleteNote: (noteId: string) => void;
  clearNotes: () => void;
}

function loadNotesFromStorage(): NoteItem[] {
  try {
    const rawNotes = localStorage.getItem(NOTES_STORAGE_KEY);

    if (!rawNotes) {
      return [];
    }

    return JSON.parse(rawNotes) as NoteItem[];
  } catch (error) {
    console.error("Failed to load notes from localStorage:", error);
    return [];
  }
}

function saveNotesToStorage(notes: NoteItem[]) {
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error("Failed to save notes to localStorage:", error);
  }
}

function parseNoteDraft(rawValue: string) {
  const lines = rawValue
    .split("\n")
    .map((line) => line.replace(/\r/g, ""));

  const firstNonEmptyIndex = lines.findIndex((line) => line.trim() !== "");

  if (firstNonEmptyIndex === -1) {
    return {
      title: "Untitled Note",
      content: "",
    };
  }

  const normalizedLines = lines.slice(firstNonEmptyIndex);
  const [titleLine, ...contentLines] = normalizedLines;

  return {
    title: titleLine.trim() || "Untitled Note",
    content: contentLines.join("\n").trim(),
  };
}

export const useNoteStore = create<NoteStore>((set) => ({
  notes: loadNotesFromStorage(),

  addNote: (input) => {
    const trimmedContent = input.content.trim();

    if (!trimmedContent) return;

    const now = Date.now();
    const parsedNote = parseNoteDraft(trimmedContent);

    const newNote: NoteItem = {
      id: nanoid(),
      type: "note",
      title: parsedNote.title,
      content: parsedNote.content,
      linkedEntityId: input.linkedEntityId,
      linkedEntityType: input.linkedEntityType,
      linkedEntityTitle: input.linkedEntityTitle,
      timestamp: input.timestamp,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const nextNotes = [newNote, ...state.notes];
      saveNotesToStorage(nextNotes);

      return {
        notes: nextNotes,
      };
    });
  },

  updateNote: (noteId, content) => {
  const trimmedContent = content.trim();

  if (!trimmedContent) return;

  set((state) => {
    const parsedNote = parseNoteDraft(trimmedContent);

    const nextNotes = state.notes.map((note) =>
      note.id === noteId
        ? {
            ...note,
            title: parsedNote.title,
            content: parsedNote.content,
            updatedAt: Date.now(),
          }
        : note,
    );

    saveNotesToStorage(nextNotes);

    return {
      notes: nextNotes,
    };
  });
},

  deleteNote: (noteId) => {
    set((state) => {
      const nextNotes = state.notes.filter((note) => note.id !== noteId);
      saveNotesToStorage(nextNotes);

      return {
        notes: nextNotes,
      };
    });
  },

  clearNotes: () => {
    saveNotesToStorage([]);
    set({ notes: [] });
  },
}));