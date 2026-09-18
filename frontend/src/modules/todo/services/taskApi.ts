import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiRequest,
} from "../../../lib/api";

import type { PagedResponse } from "../../media/services/libraryApi";
import type { Tag } from "../../media/services/tagApi";
import type { Category } from "../../organization/services/categoryApi";

export type TaskStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED";

export type TaskSourceStatus =
  | "INDEPENDENT"
  | "HAS_SOURCE"
  | "SOURCE_MISSING";

export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  deadline: string | null;
  sourceStatus: TaskSourceStatus;
  sourceNoteId: number | null;
  category: Category | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description: string | null;
  deadline: string | null;
}

export interface UpdateTaskInput {
  title: string;
  description: string | null;
  deadline: string | null;
}

export interface TaskQuery {
  page?: number;
  size?: number;
  q?: string;
  status?: TaskStatus;
  deadlineFrom?: string;
  deadlineTo?: string;
  libraryVideoId?: number;
  libraryImageId?: number;
  libraryAudioId?: number;
  categoryId?: number;
  tagIds?: number[];
  sourceStatus?: TaskSourceStatus;
  sortBy?:
    | "createdAt"
    | "updatedAt"
    | "deadline";
  sortDirection?: "asc" | "desc";
}

export interface UpdateTaskOrganizationInput {
  categoryId: number | null;
  tagIds: number[];
}

export interface TaskOrganization {
  category: Category | null;
  tags: Tag[];
}

export interface DailyPlan {
  currentDate: string;
  timeZone: string;

  overdue: Task[];
  today: Task[];
  upcoming: Task[];
  noDeadline: Task[];
  completed: Task[];
}

function buildTaskQuery(
  query: TaskQuery = {},
) {
  const params =
    new URLSearchParams();

  if (query.page !== undefined) {
    params.set(
      "page",
      String(query.page),
    );
  }

  if (query.size !== undefined) {
    params.set(
      "size",
      String(query.size),
    );
  }

  if (query.q?.trim()) {
    params.set(
      "q",
      query.q.trim(),
    );
  }

  if (query.status) {
    params.set(
      "status",
      query.status,
    );
  }

  if (query.deadlineFrom) {
    params.set(
      "deadlineFrom",
      query.deadlineFrom,
    );
  }

  if (query.deadlineTo) {
    params.set(
      "deadlineTo",
      query.deadlineTo,
    );
  }

  if (query.libraryVideoId !== undefined) {
    params.set(
      "libraryVideoId",
      String(query.libraryVideoId),
    );
  }

  if (query.libraryImageId !== undefined) {
    params.set(
      "libraryImageId",
      String(query.libraryImageId),
    );
  }

  if (query.libraryAudioId !== undefined) {
    params.set(
      "libraryAudioId",
      String(query.libraryAudioId),
    );
  }

  if (
    query.categoryId !== undefined
  ) {
    params.set(
      "categoryId",
      String(query.categoryId),
    );
  }

  query.tagIds?.forEach(
    (tagId) => {
      params.append(
        "tagId",
        String(tagId),
      );
    },
  );

  if (query.sourceStatus) {
    params.set(
      "sourceStatus",
      query.sourceStatus,
    );
  }

  if (query.sortBy) {
    params.set(
      "sortBy",
      query.sortBy,
    );
  }

  if (query.sortDirection) {
    params.set(
      "sortDirection",
      query.sortDirection,
    );
  }

  const value =
    params.toString();

  return value
    ? `?${value}`
    : "";
}

export function getTasks(
  query: TaskQuery = {},
) {
  return apiGet<
    PagedResponse<Task>
  >(
    `/api/tasks${buildTaskQuery(
      query,
    )}`,
  );
}

export function getTask(
  taskId: number,
) {
  return apiGet<Task>(
    `/api/tasks/${taskId}`,
  );
}

export function createIndependentTask(
  input: CreateTaskInput,
) {
  return apiPost<
    Task,
    CreateTaskInput
  >(
    "/api/tasks",
    input,
  );
}

export function createTaskFromNote(
  noteId: number,
  input: CreateTaskInput,
) {
  return apiPost<
    Task,
    CreateTaskInput
  >(
    `/api/notes/${noteId}/tasks`,
    input,
  );
}

export function updateTask(
  taskId: number,
  input: UpdateTaskInput,
) {
  return apiPatch<
    Task,
    UpdateTaskInput
  >(
    `/api/tasks/${taskId}`,
    input,
  );
}

export function updateTaskStatus(
  taskId: number,
  status: TaskStatus,
) {
  return apiPatch<
    Task,
    { status: TaskStatus }
  >(
    `/api/tasks/${taskId}/status`,
    {
      status,
    },
  );
}

export function deleteTask(
  taskId: number,
) {
  return apiDelete(
    `/api/tasks/${taskId}`,
  );
}

export function getDailyPlan() {
  const timeZone =
    Intl.DateTimeFormat()
      .resolvedOptions()
      .timeZone;

  return apiRequest<DailyPlan>(
    "/api/plan",
    {
      method: "GET",

      headers: timeZone
        ? {
            "X-Time-Zone":
              timeZone,
          }
        : undefined,
    },
  );
}

export function updateTaskOrganization(
  taskId: number,
  input: UpdateTaskOrganizationInput,
) {
  return apiPatch<
    TaskOrganization,
    UpdateTaskOrganizationInput
  >(
    `/api/tasks/${taskId}/organization`,
    input,
  );
}
