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

export const useNoteStore = create<NoteStore>((set) => ({
  notes: loadNotesFromStorage(),

  addNote: (input) => {
    const now = Date.now();
    const newNote: NoteItem = {
      id: nanoid(),
      type: "note",
      title: input.content.slice(0, 40) || "Untitled Note",
      content: input.content,
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