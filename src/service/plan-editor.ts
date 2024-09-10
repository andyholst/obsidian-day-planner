import { groupBy } from "lodash/fp";
import { Moment } from "moment";
import type { CachedMetadata } from "obsidian";
import { getAllDailyNotes, getDailyNote } from "obsidian-daily-notes-interface";
import { getHeadingByText, getListItemsUnderHeading } from "../parser/parser";
import type { DayPlannerSettings } from "../settings";
import type { Task } from "../types";
import { createDailyNoteIfNeeded } from "../util/daily-notes";
import { getFirstLine, updateTaskText } from "../util/task-utils";
import type { ObsidianFacade } from "./obsidian-facade";

export class PlanEditor {
  constructor(
    private readonly settings: () => DayPlannerSettings,
    private readonly obsidianFacade: ObsidianFacade,
  ) {}

  private async ensureFilesForTasks(tasks: Task[]) {
    return Promise.all(tasks.map(async (task) => {
      const { path } = await createDailyNoteIfNeeded(task.startTime);
      return { ...task, location: { ...task.location, path } };
    }));
  }

  syncTasksWithFile = async ({
    updated,
    created,
    moved,
  }: {
    updated: Task[];
    created: Task[];
    moved: { dayKey: string; task: Task }[];
  }) => {
    if (created.length > 0) {
      const [task] = await this.ensureFilesForTasks(created);
      return this.obsidianFacade.editFile(task.location.path, (contents) => 
        this.writeTaskToFileContents(task, contents, task.location.path)
      );
    }

    if (moved.length > 0) {
      const movedTask = moved[0];

      await this.obsidianFacade.editFile(movedTask.task.location.path, (contents) => 
        this.removeTaskFromFileContents(movedTask.task, contents)
      );

      const withNewDates = moved.map(({ dayKey, task }) => ({
        ...task,
        startTime: task.startTime.clone().set({
          year: window.moment(dayKey).year(),
          month: window.moment(dayKey).month(),
          date: window.moment(dayKey).date(),
        }),
      }));

      const [task] = await this.ensureFilesForTasks(withNewDates);
      const noteForFile = getDailyNote(window.moment(task.startTime), getAllDailyNotes());

      return this.obsidianFacade.editFile(noteForFile.path, (contents) => 
        this.writeTaskToFileContents(updateTaskText(task), contents, noteForFile.path)
      );
    }

    const tasksByPath = groupBy(task => task.location.path, updated);

    const editPromises = Object.keys(tasksByPath).map(async (path) =>
      this.obsidianFacade.editFile(path, (contents) =>
        tasksByPath[path].reduce(
          (result, current) => this.updateTaskInFileContents(result, current),
          contents,
        )
      )
    );

    return Promise.all(editPromises);
  };

  private writeTaskToFileContents(task: Task, contents: string, path: string) {
    const metadata = this.obsidianFacade.getMetadataForPath(path) || {};
    const [planEndLine, splitContents] = this.getPlanEndLine(contents.split("\n"), metadata);

    splitContents.splice(planEndLine + 1, 0, task.text);
    return splitContents.join("\n");
  }

  private removeTaskFromFileContents(task: Task, contents: string) {
    const newContents = contents.split("\n");
    newContents.splice(task.location.position.start.line, task.text.split("\n").length);
    return newContents.join("\n");
  }

  createPlannerHeading() {
    const { plannerHeading, plannerHeadingLevel } = this.settings();
    return `${"#".repeat(plannerHeadingLevel)} ${plannerHeading}`;
  }

  private updateTaskInFileContents(contents: string, task: Task) {
    return contents.split("\n")
      .map((line, index) => index === task.location?.position?.start?.line
        ? line.substring(0, task.location.position.start.col) + getFirstLine(task.text)
        : line
      )
      .join("\n");
  }

  private getPlanEndLine(contents: string[], metadata: CachedMetadata): [number, string[]] {
    const planHeading = getHeadingByText(metadata, this.settings().plannerHeading);
    const planListItems = getListItemsUnderHeading(metadata, this.settings().plannerHeading);

    if (planListItems?.length) {
      const lastItem = planListItems[planListItems.length - 1];
      return [lastItem.position.start.line, contents];
    }

    if (planHeading) {
      return [planHeading.position.start.line, contents];
    }

    const newContents = [...contents, "", this.createPlannerHeading(), ""];
    return [newContents.length, newContents];
  }
}
