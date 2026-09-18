import {
  CheckSquare,
  StickyNote,
} from "lucide-react";
import {
  type KeyboardEvent,
  useEffect,
  useId,
  useRef,
} from "react";

import {
  getWorkspaceSource,
  useContextStore,
} from "../../stores/contextStore";

import { QuickNotePanel } from "../../modules/notes/components/QuickNotePanel";
import { TodoPanel } from "../../modules/todo/components/TodoPanel";
import { useNoteStore } from "../../stores/noteStore";
import { useTodoStore } from "../../stores/todoStore";
import {
  type WorkspaceTab,
  useWorkspaceStore,
} from "../../stores/workspaceStore";

export function RightDock() {
  const activeTab = useWorkspaceStore(
    (state) => state.activeTab,
  );
  const setActiveTab = useWorkspaceStore(
    (state) => state.selectTab,
  );
  const notesTabRef =
    useRef<HTMLButtonElement | null>(null);
  const todosTabRef =
    useRef<HTMLButtonElement | null>(null);
  const notesTabId = useId();
  const todosTabId = useId();
  const panelId = useId();

  const activeContext = useContextStore(
    (state) => state.activeContext,
  );

  const workspaceNotes = useNoteStore(
    (state) => state.workspaceNotes,
  );

  const loadWorkspaceNotes = useNoteStore(
    (state) => state.loadWorkspaceNotes,
  );

  const workspaceNotesLoadStatus =
    useNoteStore(
      (state) =>
        state.workspaceNotesLoadStatus,
    );

  const dailyPlan = useTodoStore(
    (state) => state.dailyPlan,
  );

  const loadDailyPlan = useTodoStore(
    (state) => state.loadDailyPlan,
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

  const activeSource =
    getWorkspaceSource(activeContext);
  const activeSourceKey =
    activeSource?.key ?? null;
  const activeSourceType =
    activeSource?.entityType ?? null;
  const activeSourceLibraryId =
    activeSource?.libraryId ?? null;

  const currentSourceNotes =
    activeSourceKey !== null
      ? workspaceNotes[activeSourceKey] ?? []
      : [];

  const relatedNoteIds = new Set(
    currentSourceNotes.map(
      (note) => note.id,
    ),
  );

  const allTasks = dailyPlan
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
        task.sourceNoteId !== null &&
        relatedNoteIds.has(
          task.sourceNoteId,
        ),
    ).length;

  const noteCount =
    activeSourceKey !== null &&
    workspaceNotesLoadStatus[
      activeSourceKey
    ] === "success"
      ? currentSourceNotes.length
      : null;

  const taskCount =
    noteCount !== null &&
    dailyPlanLoadStatus ===
      "success" &&
    dailyPlan !== null
      ? relatedTasksCount
      : null;

  useEffect(() => {
    if (
      activeSourceType !== null &&
      activeSourceLibraryId !== null
    ) {
      void loadWorkspaceNotes({
        entityType: activeSourceType,
        libraryId: activeSourceLibraryId,
      }).catch(() => {
        // noteStore keeps error.
      });
    }
  }, [
    activeSourceKey,
    activeSourceType,
    activeSourceLibraryId,
    loadWorkspaceNotes,
  ]);

  useEffect(() => {
    void loadDailyPlan().catch(() => {
      // todoStore keeps error.
    });
  }, [
    loadDailyPlan,
    dailyPlanRevision,
  ]);

  function selectTab(tab: WorkspaceTab) {
    setActiveTab(tab);

    const tabRef =
      tab === "notes"
        ? notesTabRef
        : todosTabRef;

    tabRef.current?.focus();
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
  ) {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();

    if (
      event.key === "Home" ||
      (event.key === "ArrowLeft" &&
        activeTab === "todos") ||
      (event.key === "ArrowRight" &&
        activeTab === "todos")
    ) {
      selectTab("notes");
      return;
    }

    selectTab("todos");
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label="Workspace tools"
        className="grid grid-cols-2 rounded-lg border border-(--border) bg-(--surface) p-0.5"
      >
        <button
          ref={notesTabRef}
          id={notesTabId}
          type="button"
          role="tab"
          aria-controls={panelId}
          aria-selected={
            activeTab === "notes"
          }
          tabIndex={
            activeTab === "notes"
              ? 0
              : -1
          }
          onKeyDown={
            handleTabKeyDown
          }
          onClick={() =>
            setActiveTab("notes")
          }
          className={`flex h-10 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) xl:h-8 ${
            activeTab === "notes"
              ? "bg-(--surface-active) text-(--text-primary)"
              : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary)"
          }`}
        >
          <StickyNote
            size={14}
            aria-hidden="true"
          />
          Notes
          <span className="text-[11px] text-(--text-muted)">
            {noteCount ?? "—"}
          </span>
        </button>

        <button
          ref={todosTabRef}
          id={todosTabId}
          type="button"
          role="tab"
          aria-controls={panelId}
          aria-selected={
            activeTab === "todos"
          }
          tabIndex={
            activeTab === "todos"
              ? 0
              : -1
          }
          onKeyDown={
            handleTabKeyDown
          }
          onClick={() =>
            setActiveTab("todos")
          }
          className={`flex h-10 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--focus) xl:h-8 ${
            activeTab === "todos"
              ? "bg-(--surface-active) text-(--text-primary)"
              : "text-(--text-muted) hover:bg-(--surface-hover) hover:text-(--text-primary)"
          }`}
        >
          <CheckSquare
            size={14}
            aria-hidden="true"
          />
          Tasks
          <span className="text-[11px] text-(--text-muted)">
            {taskCount ?? "—"}
          </span>
        </button>
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={
          activeTab === "notes"
            ? notesTabId
            : todosTabId
        }
        className="mt-3"
      >
        {activeTab === "notes" ? (
          <QuickNotePanel />
        ) : (
          <TodoPanel />
        )}
      </div>
    </div>
  );
}
