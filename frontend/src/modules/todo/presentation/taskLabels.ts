import type {
  Task,
  TaskStatus,
} from "../services/taskApi";

export function formatTaskSourceLabel(
  task: Pick<
    Task,
    "sourceStatus" | "sourceNoteId"
  >,
) {
  switch (task.sourceStatus) {
    case "HAS_SOURCE":
      return task.sourceNoteId
        ? `Linked to Note #${task.sourceNoteId}`
        : "Linked to Note";
    case "SOURCE_MISSING":
      return "Source missing";
    case "INDEPENDENT":
      return "Independent";
  }
}

export function formatTaskStatusLabel(
  status: TaskStatus,
) {
  switch (status) {
    case "NOT_STARTED":
      return "Not started";
    case "IN_PROGRESS":
      return "In progress";
    case "COMPLETED":
      return "Completed";
  }
}
