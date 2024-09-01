import type { Moment } from "moment/moment";
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

export function getDaysOfCurrentWeek(): Moment[] {
  return getDaysOfWeek(window.moment());
}

export function getDaysOfWeek(moment: Moment): Moment[] {
  const firstDay = moment.clone().startOf("isoWeek");
  const days = new Array<Moment>(7);
  days[0] = firstDay;

  for (let i = 1; i < 7; i++) {
    days[i] = firstDay.clone().add(i, "day");
  }

  return days;
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

export function getEarliestMoment(moments: Moment[]): Moment {
  return moments.reduce((result, current) =>
    current.isBefore(result) ? current : result
  );
}
