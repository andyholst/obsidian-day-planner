import { Moment } from "moment";
import { STask } from "obsidian-dataview";

import { clockFormat, clockKey, clockSeparator } from "../constants";
import { getDiffInMinutes, getMinutesSinceMidnight } from "./moment";
import { createProp, updateProp } from "./properties";

interface Time {
  startMinutes: number;
  durationMinutes: number;
}

export type ClockMoments = [Moment, Moment];

export function toClockMoments(clockPropValue: string): ClockMoments {
  return clockPropValue
    .split(clockSeparator)
    .map((value) => window.moment(value)) as ClockMoments;
}

export function areValidClockMoments(clockMoments: Moment[]): boolean {
  return (
    clockMoments.length === 2 &&
    clockMoments.every((clockMoment) => clockMoment.isValid())
  );
}

export function toTime([start, end]: ClockMoments): Time {
  return {
    startMinutes: getMinutesSinceMidnight(start),
    durationMinutes: getDiffInMinutes(end, start),
  };
}

export function hasActiveClockProp(sTask: STask): boolean {
  if (!sTask.clocked) {
    return false;
  }

  return Array.isArray(sTask.clocked)
    ? sTask.clocked.some(isActiveClockProp)
    : isActiveClockProp(sTask.clocked);
}

function isActiveClockProp(clockPropValue: unknown): boolean {
  return !String(clockPropValue).includes(clockSeparator);
}

export function createClockTimestamp(): string {
  return window.moment().format(clockFormat);
}

export function createActiveClock(): string {
  return createProp(clockKey, createClockTimestamp());
}

export function clockOut(line: string): string {
  return updateProp(
    line,
    (previous) => `${previous}${clockSeparator}${createClockTimestamp()}`
  );
}

export function containsActiveClock(line: string): boolean {
  return line.includes(clockKey) && !line.includes(clockSeparator);
}

export function withActiveClock(sTask: STask): STask {
  return {
    ...sTask,
    text: `${sTask.text.trimEnd()}\n${createActiveClock()}`,
  };
}

export function withoutActiveClock(sTask: STask): STask {
  return {
    ...sTask,
    text: lines(
      (textLines) => textLines.filter((line) => !containsActiveClock(line)),
      sTask.text
    ),
  };
}

export function lines(fn: (lines: string[]) => string[], text: string): string {
  return fn(text.split("\n")).join("\n");
}

export function withActiveClockCompleted(sTask: STask): STask {
  return {
    ...sTask,
    text: lines(
      (textLines) =>
        textLines.map((line) =>
          containsActiveClock(line) ? clockOut(line) : line
        ),
      sTask.text
    ),
  };
}

export function assertActiveClock(sTask: STask): STask {
  if (!hasActiveClockProp(sTask)) {
    throw new Error("The task has no active clocks");
  }
  return sTask;
}

export function assertNoActiveClock(sTask: STask): STask {
  if (hasActiveClockProp(sTask)) {
    throw new Error("The task already has an active clock");
  }
  return sTask;
}
