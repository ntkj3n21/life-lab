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

  useEffect(() => {
    void loadDailyPlan().catch(
      () => {
        // todoStore keeps error.
      },
    );
  }, [loadDailyPlan]);

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
      <div className="rounded-2xl border border-(--border) bg-(--surface) p-4">
        <div className="flex items-center gap-2">
          <Link2
            size={16}
            className="text-(--text-muted)"
          />

          <h4 className="whitespace-nowrap font-medium">
            Now working on
          </h4>
        </div>

        <p className="mt-3 text-sm text-(--text-secondary)">
          No active context yet.
        </p>

        <p className="mt-1 text-xs text-(--text-faint)">
          Open a video to start
          linking notes and tasks.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-(--border) bg-(--surface) p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link2
            size={16}
            className="text-(--text-secondary)"
          />

          <h4 className="font-medium">
            Now working on
          </h4>
        </div>

        <span className="rounded-full bg-(--surface-hover) px-2 py-1 text-[10px] font-medium text-(--text-secondary)">
          {
            activeContext.entityType
          }
        </span>
      </div>

      <p className="mt-3 line-clamp-2 text-base font-semibold text-(--text-primary)">
        {activeContext.title}
      </p>

      <div className="mt-3 flex items-center gap-2 text-sm text-(--text-secondary)">
        <Clock
          size={14}
          className="text-(--text-muted)"
        />

        <span>
          Timestamp{" "}

          <span className="text-(--text-primary)">
            {typeof activeContext.timestamp ===
            "number"
              ? formatTime(
                  activeContext.timestamp,
                )
              : "Not recorded"}
          </span>
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
          <div className="flex items-center gap-2 text-(--text-secondary)">
            <StickyNote
              size={15}
            />

            <span className="text-xs">
              Notes
            </span>
          </div>

          <p className="mt-2 text-xl font-semibold text-(--text-primary)">
            {
              relatedNotes.length
            }
          </p>
        </div>

        <div className="rounded-xl border border-(--border) bg-(--app-bg) p-3">
          <div className="flex items-center gap-2 text-(--text-secondary)">
            <CheckSquare
              size={15}
            />

            <span className="text-xs">
              Tasks
            </span>
          </div>

          <p className="mt-2 text-xl font-semibold text-(--text-primary)">
            {
              relatedTasksCount
            }
          </p>
        </div>
      </div>
    </div>
  );
}
