import { create } from "zustand";
import { nanoid } from "nanoid";
import type { NoteItem } from "../types/lifeLab";
import type { EntityType } from "../types/lifeLab";

interface CreateNoteInput {
  content: string;
  linkedEntityId?: string;
  linkedEntityType?: EntityType;
  timestamp?: number;
}

interface NoteStore {
  notes: NoteItem[];
  addNote: (input: CreateNoteInput) => void;
}

export const useNoteStore = create<NoteStore>((set) => ({
  notes: [],

  addNote: (input) => {
    const now = Date.now();

    const newNote: NoteItem = {
      id: nanoid(),
      type: "note",
      title: input.content.slice(0, 40) || "Untitled Note",
      content: input.content,
      linkedEntityId: input.linkedEntityId,
      linkedEntityType: input.linkedEntityType,
      timestamp: input.timestamp,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => ({
      notes: [newNote, ...state.notes],
    }));
  },
}));