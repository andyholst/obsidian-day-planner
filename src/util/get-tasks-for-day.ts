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
  return tasks.map((current, i, array) => {
    if (current.durationMinutes) return current;

    const next = array[i + 1];
    const shouldExtendUntilNext = next && options.extendDurationUntilNext;

    return {
      ...current,
      durationMinutes: shouldExtendUntilNext
        ? next.startMinutes - current.startMinutes
        : options.defaultDurationMinutes,
    };
  });
}

export function mapToTasksForDay(
  day: Moment,
  tasksForDay: STask[],
  settings: DayPlannerSettings,
) {
  const [withTime, withoutTime] = partition(isTimeSetOnTask, tasksForDay);

  const { parsed: tasksWithTime, errors } = withTime.reduce(
    (result, sTask) => {
      try {
        const task = toTask(sTask, day);
        result.parsed.push(task);
      } catch (error) {
        result.errors.push(error);
      }
      return result;
    },
    { parsed: [], errors: [] }
  );

  tasksWithTime.sort((a, b) => a.startMinutes - b.startMinutes);

  const noTime = withoutTime
    .filter((sTask) => {
      return sTask.task && (settings.showUnscheduledNestedTasks || !sTask.parent);
    })
    .map((sTask) => toUnscheduledTask(sTask, day));

  // Calculate durations for tasks with time.
  const withTimeAndDuration = calculateDuration(tasksWithTime, settings);

  return { withTime: withTimeAndDuration, noTime, errors };
}
