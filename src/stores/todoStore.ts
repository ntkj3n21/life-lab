import { create } from "zustand";
import { nanoid } from "nanoid";
import type { EntityType, TodoChecklistItem, TodoItem } from "../types/lifeLab";

const TODOS_STORAGE_KEY = "life-lab-todos";

function parseTodoDraft(rawValue: string) {
  const lines = rawValue
    .split("\n")
    .map((line) => line.replace(/\r/g, "").trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return {
      title: "Untitled Todo",
      content: "",
      items: [],
    };
  }

  const [titleLine, ...itemLines] = lines;

  const items: TodoChecklistItem[] = itemLines.map((text) => ({
    id: nanoid(),
    text,
    done: false,
  }));

  return {
    title: titleLine,
    content: itemLines.join("\n"),
    items,
  };
}

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
  updateTodo: (todoId: string, content: string) => void;
  toggleTodo: (todoId: string) => void;
  toggleTodoItem: (todoId: string, itemId: string) => void;
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
    const trimmedContent = input.content.trim();

    if (!trimmedContent) return;

    const now = Date.now();
    const parsedTodo = parseTodoDraft(trimmedContent);

    const newTodo: TodoItem = {
      id: nanoid(),
      type: "todo",
      title: parsedTodo.title,
      content: parsedTodo.content,
      done: false,
      items: parsedTodo.items,
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

  updateTodo: (todoId, content) => {
    const trimmedContent = content.trim();

    if (!trimmedContent) return;

    const parsedTodo = parseTodoDraft(trimmedContent);

    set((state) => {
      const nextTodos = state.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              title: parsedTodo.title,
              content: parsedTodo.content,
              items: parsedTodo.items,
              done:
                parsedTodo.items.length > 0
                  ? parsedTodo.items.every((item) => item.done)
                  : todo.done,
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

  toggleTodo: (todoId) => {
    set((state) => {
      const nextTodos = state.todos.map((todo) => {
        if (todo.id !== todoId) return todo;

        const nextDone = !todo.done;

        return {
          ...todo,
          done: nextDone,
          items: (todo.items ?? []).map((item) => ({
            ...item,
            done: nextDone,
          })),
          updatedAt: Date.now(),
        };
      });

      saveTodosToStorage(nextTodos);

      return {
        todos: nextTodos,
      };
    });
  },

  toggleTodoItem: (todoId, itemId) => {
    set((state) => {
      const nextTodos = state.todos.map((todo) => {
        if (todo.id !== todoId) return todo;

        const nextItems = (todo.items ?? []).map((item) =>
          item.id === itemId
            ? {
                ...item,
                done: !item.done,
              }
            : item,
        );

        return {
          ...todo,
          items: nextItems,
          done:
            nextItems.length > 0
              ? nextItems.every((item) => item.done)
              : todo.done,
          updatedAt: Date.now(),
        };
      });

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