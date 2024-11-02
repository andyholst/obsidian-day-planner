import type { Moment } from "moment/moment";

import type { DayPlannerSettings } from "../settings";
import type { RelationToNow } from "../types";

const moment = window.moment;

const defaultTimestampFormat = "hh:mm";

export function getMinutesSinceMidnight(moment: Moment): number {
  return moment.hours() * 60 + moment.minutes();
}

export function toMinutes(time: string): number {
  const parsed = moment(time, defaultTimestampFormat);
  return getMinutesSinceMidnight(parsed);
}

export function getDiffInMinutes(a: Moment, b: Moment): number {
  return Math.abs(a.diff(b, "minutes"));
}

export function getMomentFromDayOfWeek(
  startingDay: Moment,
  firstDayOFWeek: DayPlannerSettings["firstDayOfWeek"],
) {
  const startOfIsoWeek = startingDay.startOf("isoWeek");
  const subtractDays: Record<DayPlannerSettings["firstDayOfWeek"], number> = {
    monday: 0,
    sunday: 1,
    saturday: 2,
    friday: 3,
  };

  return startOfIsoWeek.subtract(subtractDays[firstDayOFWeek], "days");
}

export function minutesToMomentOfDay(
  minutesSinceMidnight: number,
  moment: Moment,
): Moment {
  return moment.clone().startOf("day").add(minutesSinceMidnight, "minutes");
}

export function minutesToMoment(minutesSinceMidnight: number): Moment {
  return moment().startOf("day").add(minutesSinceMidnight, "minutes");
}

export function hoursToMoment(hoursSinceMidnight: number): Moment {
  return moment().startOf("day").add(hoursSinceMidnight, "hours");
}

export function addMinutes(moment: Moment, minutes: number): Moment {
  return moment.clone().add(minutes, "minutes");
}

export function getRelationToNow(
  now: Moment,
  start: Moment,
  end: Moment,
): RelationToNow {
  if (end.isBefore(now)) {
    return "past";
  }

  if (start.isAfter(now)) {
    return "future";
  }

  return "present";
}

export function splitMultiday(
  start: Moment,
  end: Moment,
  chunks: Array<[Moment, Moment]> = [],
): Array<[Moment, Moment]> {
  const endOfDayForStart = start.clone().endOf("day");

  if (end.isBefore(endOfDayForStart)) {
    chunks.push([start, end]);
    return chunks;
  }

  chunks.push([start, endOfDayForStart]);

  const newStart = start.clone().add(1, "day").startOf("day");
  return splitMultiday(newStart, end, chunks);
}

export function getEarliestMoment(moments: Moment[]) {
  return moments.reduce((result, current) => {
    if (current.isBefore(result)) {
      return current;
    }

    return result;
  });
}

export function isOnWeekend(day: Moment) {
  return day.isoWeekday() === 6 || day.isoWeekday() === 7;
}
