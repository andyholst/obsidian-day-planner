import { partition } from "lodash/fp";
import { Moment } from "moment/moment";
import { STask } from "obsidian-dataview";

import { timeFromStartRegExp } from "../regexp";
import { DayPlannerSettings } from "../settings";
import { Task } from "../types";

import { toTask, toUnscheduledTask } from "./dataview";

function isTimeSetOnTask(task: STask) {
  return timeFromStartRegExp.test(task.text);
}

type DurationOptions = Pick<
  DayPlannerSettings,
  "defaultDurationMinutes" | "extendDurationUntilNext"
>;

function calculateDuration(tasks: Task[], options: DurationOptions) {
  return tasks.map((current, i) => {
    if (current.durationMinutes) return current;

    const next = tasks[i + 1];
    const durationMinutes = next && options.extendDurationUntilNext
      ? next.startMinutes - current.startMinutes
      : options.defaultDurationMinutes;

    return { ...current, durationMinutes };
  });
}

export function mapToTasksForDay(
  day: Moment,
  tasksForDay: STask[],
  settings: DayPlannerSettings,
) {
  const [withTime, withoutTime] = partition(isTimeSetOnTask, tasksForDay);

  const tasksWithTime = [];
  const errors = [];

  for (const sTask of withTime) {
    try {
      tasksWithTime.push(toTask(sTask, day));
    } catch (error) {
      errors.push(error);
    }
  }

  tasksWithTime.sort((a, b) => a.startMinutes - b.startMinutes);

  const noTime = withoutTime
    .filter((sTask) => {
      if (!sTask.task) return false;
      return settings.showUnscheduledNestedTasks || !sTask.parent;
    })
    .map((sTask) => toUnscheduledTask(sTask, day));

  const withTimeAndDuration = calculateDuration(tasksWithTime, settings);

  return { withTime: withTimeAndDuration, noTime, errors };
}
