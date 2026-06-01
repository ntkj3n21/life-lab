import { create } from "zustand";
import { nanoid } from "nanoid";
import type { EntityType, TodoItem } from "../types/lifeLab";

const TODOS_STORAGE_KEY = "life-lab-todos";

interface CreateTodoInput {
  content: string;
  linkedEntityId?: string;
  linkedEntityType?: EntityType;
  linkedEntityTitle?: string;
  timestamp?: number;
}

interface TodoStore {
  todos: TodoItem[];
  addTodo: (input: CreateTodoInput) => void;
  toggleTodo: (todoId: string) => void;
  deleteTodo: (todoId: string) => void;
  clearTodos: () => void;
}

function loadTodosFromStorage(): TodoItem[] {
  try {
    const rawTodos = localStorage.getItem(TODOS_STORAGE_KEY);

    if (!rawTodos) {
      return [];
    }

    return JSON.parse(rawTodos) as TodoItem[];
  } catch (error) {
    console.error("Failed to load todos from localStorage:", error);
    return [];
  }
}

function saveTodosToStorage(todos: TodoItem[]) {
  try {
    localStorage.setItem(TODOS_STORAGE_KEY, JSON.stringify(todos));
  } catch (error) {
    console.error("Failed to save todos to localStorage:", error);
  }
}

export const useTodoStore = create<TodoStore>((set) => ({
  todos: loadTodosFromStorage(),

  addTodo: (input) => {
    const now = Date.now();

    const newTodo: TodoItem = {
      id: nanoid(),
      type: "todo",
      title: input.content.slice(0, 40) || "Untitled Todo",
      content: input.content,
      done: false,
      linkedEntityId: input.linkedEntityId,
      linkedEntityType: input.linkedEntityType,
      linkedEntityTitle: input.linkedEntityTitle,
      timestamp: input.timestamp,
      createdAt: now,
      updatedAt: now,
    };

    set((state) => {
      const nextTodos = [newTodo, ...state.todos];
      saveTodosToStorage(nextTodos);

      return {
        todos: nextTodos,
      };
    });
  },

  toggleTodo: (todoId) => {
    set((state) => {
      const nextTodos = state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              done: !todo.done,
              updatedAt: Date.now(),
            }
          : todo,
      );

      saveTodosToStorage(nextTodos);

      return {
        todos: nextTodos,
      };
    });
  },

  deleteTodo: (todoId) => {
    set((state) => {
      const nextTodos = state.todos.filter((todo) => todo.id !== todoId);
      saveTodosToStorage(nextTodos);

      return {
        todos: nextTodos,
      };
    });
  },

  clearTodos: () => {
    saveTodosToStorage([]);
    set({ todos: [] });
  },
}));