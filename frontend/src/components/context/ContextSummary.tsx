import {
  CheckSquare,
  Clock,
  Link2,
  StickyNote,
} from "lucide-react";

import { useEffect } from "react";

import { useContextStore } from "../../stores/contextStore";
import { useNoteStore } from "../../stores/noteStore";
import { useTodoStore } from "../../stores/todoStore";

import { formatTime } from "../../utils/formatTime";

export function ContextSummary() {
  const activeContext =
    useContextStore(
      (state) =>
        state.activeContext,
    );

  const videoNotesByVideo =
    useNoteStore(
      (state) =>
        state.videoNotes,
    );

  const loadVideoNotes =
    useNoteStore(
      (state) =>
        state.loadVideoNotes,
    );

  const videoNotesLoadStatus =
    useNoteStore(
      (state) =>
        state.videoNotesLoadStatus,
    );

  const dailyPlan =
    useTodoStore(
      (state) =>
        state.dailyPlan,
    );

  const loadDailyPlan =
    useTodoStore(
      (state) =>
        state.loadDailyPlan,
    );

  const dailyPlanLoadStatus =
    useTodoStore(
      (state) =>
        state.dailyPlanLoadStatus,
    );

  const dailyPlanRevision =
    useTodoStore(
      (state) =>
        state.dailyPlanRevision,
    );

  const activeLibraryVideoId =
    activeContext?.entityType ===
      "video"
      ? Number(
          activeContext.entityId,
        )
      : null;

  const validVideoId =
    activeLibraryVideoId !==
      null &&
    Number.isFinite(
      activeLibraryVideoId,
    )
      ? activeLibraryVideoId
      : null;

  const relatedNotes =
    validVideoId !== null
      ? videoNotesByVideo[
          validVideoId
        ] ?? []
      : [];

  const notesResolved =
    validVideoId !== null &&
    videoNotesLoadStatus[
      validVideoId
    ] === "success";

  const tasksResolved =
    notesResolved &&
    dailyPlanLoadStatus ===
      "success" &&
    dailyPlan !== null;

  useEffect(() => {
    void loadDailyPlan().catch(
      () => {
        // todoStore keeps error.
      },
    );
  }, [
    loadDailyPlan,
    dailyPlanRevision,
  ]);

  useEffect(() => {
    if (
      validVideoId === null
    ) {
      return;
    }

    void loadVideoNotes(
      validVideoId,
    ).catch(() => {
      // noteStore keeps error.
    });
  }, [
    validVideoId,
    loadVideoNotes,
  ]);

  const relatedNoteIds =
    new Set(
      relatedNotes.map(
        (note) => note.id,
      ),
    );

  const allTasks =
    dailyPlan
      ? [
          ...dailyPlan.overdue,
          ...dailyPlan.today,
          ...dailyPlan.upcoming,
          ...dailyPlan.noDeadline,
          ...dailyPlan.completed,
        ]
      : [];

  const relatedTasksCount =
    allTasks.filter(
      (task) =>
        task.sourceNoteId !==
          null &&
        relatedNoteIds.has(
          task.sourceNoteId,
        ),
    ).length;

  if (!activeContext) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5">
        <Link2
          size={13}
          className="text-(--text-muted)"
        />

        <span className="text-xs font-medium text-(--text-secondary)">
          Now working on
        </span>

        <span className="text-xs text-(--text-muted)">
          No active video context.
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-(--border) bg-(--surface) px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
        <Clock
          size={13}
          className="text-(--text-muted)"
          aria-hidden="true"
        />
        <span className="tabular-nums text-(--text-primary)">
          {typeof activeContext.timestamp ===
          "number"
            ? formatTime(
                activeContext.timestamp,
              )
            : "—"}
        </span>
      </div>

      <div
        className="h-4 w-px bg-(--border)"
        aria-hidden="true"
      />

      <div className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
        <StickyNote
          size={13}
          aria-hidden="true"
        />
        <span>Notes</span>
        <span className="font-medium text-(--text-primary)">
          {notesResolved
            ? relatedNotes.length
            : "—"}
        </span>
      </div>

      <div
        className="h-4 w-px bg-(--border)"
        aria-hidden="true"
      />

      <div className="flex items-center gap-1.5 text-xs text-(--text-secondary)">
        <CheckSquare
          size={13}
          aria-hidden="true"
        />
        <span>Tasks</span>
        <span className="font-medium text-(--text-primary)">
          {tasksResolved
            ? relatedTasksCount
            : "—"}
        </span>
      </div>
    </div>
  );
}
