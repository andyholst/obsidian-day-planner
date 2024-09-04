import { Moment } from "moment/moment";
import { getDateFromPath } from "obsidian-daily-notes-interface";
import { get, Readable, Writable } from "svelte/store";

import { ObsidianFacade } from "../../../service/obsidian-facade";
import { PlacedTask, UnscheduledTask } from "../../../types";
import { createTask } from "../../../util/task-utils";

import { EditMode, EditOperation } from "./types";

export interface UseEditHandlersProps {
  startEdit: (operation: EditOperation) => void;
  day: Moment;
  obsidianFacade: ObsidianFacade;
  cursorMinutes: Readable<number>;
  editOperation: Writable<EditOperation>;
}

export function createEditHandlers({
  day,
  obsidianFacade,
  startEdit,
  cursorMinutes,
  editOperation,
}: UseEditHandlersProps) {

  function handleContainerMouseDown() {
    const cursorTime = get(cursorMinutes);
    const newTask = createTask(day, cursorTime);

    startEdit({
      task: { ...newTask, isGhost: true },
      mode: EditMode.CREATE,
      day,
    });
  }

  function handleResizerMouseDown(task: PlacedTask, mode: EditMode) {
    startEdit({ task, mode, day });
  }

  async function handleTaskMouseUp(task: UnscheduledTask) {
    if (get(editOperation)) return;

    const { path, line } = task.location;
    await obsidianFacade.revealLineInFile(path, line);
  }

  function handleGripMouseDown(task: PlacedTask, mode: EditMode) {
    startEdit({ task, mode, day });
  }

  function handleUnscheduledTaskGripMouseDown(task: UnscheduledTask) {
    const cursorTime = get(cursorMinutes);
    const startTime = task.location
      ? getDateFromPath(task.location.path, "day") || window.moment()
      : window.moment();

    const withAddedTime = { ...task, startMinutes: cursorTime, startTime };

    startEdit({ task: withAddedTime, mode: EditMode.DRAG, day });
  }

  function handleMouseEnter() {
    editOperation.update((previous) => previous && { ...previous, day });
  }

  return {
    handleMouseEnter,
    handleGripMouseDown,
    handleContainerMouseDown,
    handleResizerMouseDown,
    handleTaskMouseUp,
    handleUnscheduledTaskGripMouseDown,
  };
}

export type EditHandlers = ReturnType<typeof createEditHandlers>;
