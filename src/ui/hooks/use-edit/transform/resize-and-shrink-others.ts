import { last } from "lodash";

import type { Task } from "../../../../types";
import { getEndMinutes } from "../../../../util/task-utils";

// todo: use constant from settings
const minimalDurationMinutes = 10;

export function resizeAndShrinkOthers(
  baseline: Task[],
  editTarget: Task,
  cursorTime: number,
): Task[] {
  const index = baseline.findIndex((task) => task.id === editTarget.id);
  const preceding = baseline.slice(0, index);
  const following = baseline.slice(index + 1);

  const durationMinutes = cursorTime - editTarget.startMinutes;

  const updated = {
    ...editTarget,
    durationMinutes,
  };

  const updatedFollowing = following.reduce((result, current) => {
    const previous = last(result) || updated;
    const currentNeedsToShrink = getEndMinutes(previous) > current.startMinutes;

    if (currentNeedsToShrink) {
      const newCurrentStartMinutes = getEndMinutes(previous);
      const newCurrentDurationMinutes =
        getEndMinutes(current) - newCurrentStartMinutes;

      return [
        ...result,
        {
          ...current,
          startMinutes: newCurrentStartMinutes,
          durationMinutes: Math.max(
            newCurrentDurationMinutes,
            minimalDurationMinutes,
          ),
        },
      ];
    }

    return [...result, current];
  }, []);

  return [...preceding, updated, ...updatedFollowing];
}

export function resizeFromTopAndShrinkOthers(
  baseline: Task[],
  editTarget: Task,
  cursorTime: number,
): Task[] {
  const index = baseline.findIndex((task) => task.id === editTarget.id);
  const preceding = baseline.slice(0, index);
  const following = baseline.slice(index + 1);

  const durationMinutes =
    editTarget.startMinutes + editTarget.durationMinutes - cursorTime;

  const updated = {
    ...editTarget,
    startMinutes: cursorTime,
    durationMinutes,
  };

  const updatedPreceding = preceding
    .reverse()
    .reduce((result, current) => {
      const nextInTimeline = last(result) || updated;
      const currentNeedsToShrink =
        nextInTimeline.startMinutes < getEndMinutes(current);

      if (currentNeedsToShrink) {
        const currentNeedsToMove =
          nextInTimeline.startMinutes - current.startMinutes <
          minimalDurationMinutes;

        const newCurrentStartMinutes = currentNeedsToMove
          ? nextInTimeline.startMinutes - minimalDurationMinutes
          : current.startMinutes;

        return [
          ...result,
          {
            ...current,
            startMinutes: newCurrentStartMinutes,
            durationMinutes:
              nextInTimeline.startMinutes - newCurrentStartMinutes,
          },
        ];
      }

      return [...result, current];
    }, [])
    .reverse();

  return [...updatedPreceding, updated, ...following];
}
