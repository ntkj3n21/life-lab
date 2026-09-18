import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
} from "../../../lib/api";

export interface Category {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryNameInput {
  name: string;
}

export interface CategoryDeleteImpact {
  categoryId: number;
  noteCountToUncategorize: number;
  taskCountToUncategorize: number;
  notesPreserved: boolean;
  tasksPreserved: boolean;
}

export function getCategories() {
  return apiGet<Category[]>(
    "/api/categories",
  );
}

export function createCategory(
  input: CategoryNameInput,
) {
  return apiPost<
    Category,
    CategoryNameInput
  >("/api/categories", input);
}

export function renameCategory(
  categoryId: number,
  input: CategoryNameInput,
) {
  return apiPatch<
    Category,
    CategoryNameInput
  >(
    `/api/categories/${categoryId}`,
    input,
  );
}

export function getCategoryDeleteImpact(
  categoryId: number,
) {
  return apiGet<CategoryDeleteImpact>(
    `/api/categories/${categoryId}/delete-impact`,
  );
}

export function deleteCategory(
  categoryId: number,
) {
  return apiDelete(
    `/api/categories/${categoryId}`,
  );
}
