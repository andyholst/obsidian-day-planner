import { groupBy } from "lodash/fp";
import { Moment } from "moment";
import type { CachedMetadata } from "obsidian";
import { getAllDailyNotes, getDailyNote } from "obsidian-daily-notes-interface";
import { getHeadingByText, getListItemsUnderHeading } from "../parser/parser";
import type { DayPlannerSettings } from "../settings";
import type { PlacedTask, Task } from "../types";
import { createDailyNoteIfNeeded } from "../util/daily-notes";
import { updateTaskText } from "../util/task-utils";
import type { ObsidianFacade } from "./obsidian-facade";

export class PlanEditor {
  constructor(
    private readonly settings: () => DayPlannerSettings,
    private readonly obsidianFacade: ObsidianFacade,
  ) {}

  private async ensureFilesForTasks(tasks: Task[]): Promise<Task[]> {
    const tasksWithPaths = tasks.map(async (task) => {
      const { path } = await createDailyNoteIfNeeded(task.startTime);
      return { ...task, location: { ...task.location, path } };
    });

    return Promise.all(tasksWithPaths);
  }

  syncTasksWithFile = async ({
    updated,
    created,
    moved,
  }: {
    updated: Task[];
    created: Task[];
    moved: { dayKey: string; task: PlacedTask }[];
  }) => {
    if (created.length > 0) {
      const [task] = await this.ensureFilesForTasks(created);
      return this.obsidianFacade.editFile(task.location.path, (contents) => 
        this.writeTaskToFileContents(task, contents, task.location.path)
      );
    }

    if (moved.length > 0) {
      const movedTask = moved[0];

      await this.obsidianFacade.editFile(
        movedTask.task.location.path,
        (contents) => this.removeTaskFromFileContents(movedTask.task, contents)
      );

      const updatedTasks = moved.map(({ dayKey, task }) => {
        const parsedDay = window.moment(dayKey);
        const newStartTime = task.startTime.clone()
          .year(parsedDay.year())
          .month(parsedDay.month())
          .date(parsedDay.date());

        return { ...task, startTime: newStartTime };
      });

      const [task] = await this.ensureFilesForTasks(updatedTasks);
      const noteForFile = getDailyNote(
        window.moment(task.startTime),
        getAllDailyNotes(),
      );

      const updatedTask = updateTaskText(task);
      return this.obsidianFacade.editFile(noteForFile.path, (contents) => 
        this.writeTaskToFileContents(updatedTask, contents, noteForFile.path)
      );
    }

    const tasksByPath = groupBy((task: Task) => task.location.path, updated);
    const editPromises = Object.entries(tasksByPath).map(
      ([path, tasks]) =>
        this.obsidianFacade.editFile(path, (contents) =>
          tasks.reduce(
            (result, current) => this.updateTaskInFileContents(result, current),
            contents,
          )
        )
    );

    return Promise.all(editPromises);
  };

  private writeTaskToFileContents(task: Task, contents: string, path: string): string {
    const metadata = this.obsidianFacade.getMetadataForPath(path) || {};
    const [planEndLine, splitContents] = this.getPlanEndLine(contents.split("\n"), metadata);

    const newTaskText = [
      task.firstLineText,
      ...task.text.split("\n").slice(1),
    ].join("\n");

    const result = [...splitContents];
    result.splice(planEndLine + 1, 0, newTaskText);

    return result.join("\n");
  }

  private removeTaskFromFileContents(task: Task, contents: string): string {
    const lines = contents.split("\n");
    const taskLinesCount = task.text.split("\n").length;
    lines.splice(task.location.position.start.line, taskLinesCount);

    return lines.join("\n");
  }

  private updateTaskInFileContents(contents: string, task: Task): string {
    return contents
      .split("\n")
      .map((line, index) => 
        index === task.location?.line
          ? line.substring(0, task.location.position.start.col) + task.firstLineText
          : line
      )
      .join("\n");
  }

  private getPlanEndLine(contents: string[], metadata: CachedMetadata): [number, string[]] {
    const planHeading = getHeadingByText(metadata, this.settings().plannerHeading);
    const planListItems = getListItemsUnderHeading(metadata, this.settings().plannerHeading);

    if (planListItems?.length > 0) {
      const lastListItem = planListItems[planListItems.length - 1];
      return [lastListItem.position.start.line, contents];
    }

    if (planHeading) {
      return [planHeading.position.start.line, contents];
    }

    const withNewPlan = [...contents, "", this.createPlannerHeading(), ""];
    return [withNewPlan.length - 1, withNewPlan];
  }

  createPlannerHeading(): string {
    const { plannerHeading, plannerHeadingLevel } = this.settings();
    const headingTokens = "#".repeat(plannerHeadingLevel);
    return `${headingTokens} ${plannerHeading}`;
  }
}
