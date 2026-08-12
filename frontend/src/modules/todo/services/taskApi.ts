import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiRequest,
} from "../../../lib/api";

import type { PagedResponse } from "../../media/services/libraryApi";

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