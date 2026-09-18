import { create } from "zustand";

import { ApiError } from "../lib/api";
import {
  createCategory as createCategoryRequest,
  deleteCategory as deleteCategoryRequest,
  getCategories,
  getCategoryDeleteImpact,
  renameCategory as renameCategoryRequest,
  type Category,
  type CategoryDeleteImpact,
} from "../modules/organization/services/categoryApi";

interface CategoryStore {
  categories: Category[];
  hasLoadedCategories: boolean;
  isLoading: boolean;
  isMutating: boolean;
  error: ApiError | null;

  loadCategories: (
    force?: boolean,
  ) => Promise<Category[]>;
  createCategory: (
    name: string,
  ) => Promise<Category>;
  renameCategory: (
    categoryId: number,
    name: string,
  ) => Promise<Category>;
  getDeleteImpact: (
    categoryId: number,
  ) => Promise<CategoryDeleteImpact>;
  deleteCategory: (
    categoryId: number,
  ) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  return new ApiError(0, {
    code: "UNKNOWN_ERROR",
    message: "Something went wrong.",
    fieldErrors: {},
  });
}

function sortCategories(
  categories: Category[],
) {
  return [...categories].sort(
    (left, right) =>
      left.name.localeCompare(
        right.name,
        undefined,
        {
          sensitivity: "base",
        },
      ),
  );
}

const initialState = {
  categories: [] as Category[],
  hasLoadedCategories: false,
  isLoading: false,
  isMutating: false,
  error: null as ApiError | null,
};

export const useCategoryStore =
  create<CategoryStore>(
    (set, get) => ({
      ...initialState,

      loadCategories: async (
        force = false,
      ) => {
        if (
          get().hasLoadedCategories &&
          !force
        ) {
          return get().categories;
        }

        set({
          isLoading: true,
          error: null,
        });

        try {
          const categories =
            await getCategories();

          set({
            categories:
              sortCategories(
                categories,
              ),
            hasLoadedCategories:
              true,
          });

          return categories;
        } catch (error) {
          const apiError =
            toApiError(error);

          set({ error: apiError });
          throw apiError;
        } finally {
          set({ isLoading: false });
        }
      },

      createCategory: async (
        name,
      ) => {
        set({
          isMutating: true,
          error: null,
        });

        try {
          const category =
            await createCategoryRequest(
              { name: name.trim() },
            );

          set((state) => ({
            categories:
              sortCategories([
                ...state.categories,
                category,
              ]),
          }));

          return category;
        } catch (error) {
          const apiError =
            toApiError(error);

          set({ error: apiError });
          throw apiError;
        } finally {
          set({ isMutating: false });
        }
      },

      renameCategory: async (
        categoryId,
        name,
      ) => {
        set({
          isMutating: true,
          error: null,
        });

        try {
          const category =
            await renameCategoryRequest(
              categoryId,
              { name: name.trim() },
            );

          set((state) => ({
            categories:
              sortCategories(
                state.categories.map(
                  (candidate) =>
                    candidate.id ===
                    categoryId
                      ? category
                      : candidate,
                ),
              ),
          }));

          return category;
        } catch (error) {
          const apiError =
            toApiError(error);

          set({ error: apiError });
          throw apiError;
        } finally {
          set({ isMutating: false });
        }
      },

      getDeleteImpact: async (
        categoryId,
      ) => {
        set({ error: null });

        try {
          return await getCategoryDeleteImpact(
            categoryId,
          );
        } catch (error) {
          const apiError =
            toApiError(error);

          set({ error: apiError });
          throw apiError;
        }
      },

      deleteCategory: async (
        categoryId,
      ) => {
        set({
          isMutating: true,
          error: null,
        });

        try {
          await deleteCategoryRequest(
            categoryId,
          );

          set((state) => ({
            categories:
              state.categories.filter(
                (category) =>
                  category.id !==
                  categoryId,
              ),
          }));
        } catch (error) {
          const apiError =
            toApiError(error);

          set({ error: apiError });
          throw apiError;
        } finally {
          set({ isMutating: false });
        }
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set({ ...initialState });
      },
    }),
  );
