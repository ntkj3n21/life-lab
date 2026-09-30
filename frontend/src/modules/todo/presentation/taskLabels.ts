import type {
  Task,
  TaskStatus,
} from "../services/taskApi";

export function formatTaskSourceLabel(
  task: Pick<
    Task,
    "sourceStatus"
  >,
) {
  switch (task.sourceStatus) {
    case "HAS_SOURCE":
      return "From note";
    case "SOURCE_MISSING":
      return "Note unavailable";
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
