import type { Moment } from "moment";
import { getDateFromPath } from "obsidian-daily-notes-interface";
import { DataArray, DateTime, STask } from "obsidian-dataview";
import { isNotVoid } from "typed-assert";

import {
  defaultDayFormat,
  defaultDayFormatForLuxon,
  defaultDurationMinutes,
  indentBeforeTaskParagraph,
} from "../constants";
import { getTimeFromLine } from "../parser/parser";
import type {
  FileLine,
  TaskTokens,
  TaskWithoutComputedDuration,
} from "../task-types";

import { type ClockMoments, toTime } from "./clock";
import { getId } from "./id";
import { deleteProps } from "./properties";

export function unwrap<T>(group: ReturnType<DataArray<T>["groupBy"]>): [string, T[]][] {
  return group.map(({ key, rows }) => [key, rows.array()]);
}

interface Node {
  text: string;
  symbol: string;
  children: Node[];
  status?: string;
  scheduled?: DateTime;
}

export function textToString(node: Node): string {
  const statusText = node.status ? `[${node.status}] ` : "";
  return `${node.symbol} ${statusText}${deleteProps(node.text)}\n`;
}

export function toString(node: Node, indentation = "") {
  let result = `${indentation}${textToString(node)}`;
  const childIndentation = `\t${indentation}`;

  for (const child of node.children) {
    // todo (minor): handle custom indentation (spaces of differing lengths)
    result += toString(child, `\t${indentation}`);
  }

  return result;
}

export function getLines(node, result: Array<FileLine> = []) {
  result.push({ text: node.text, line: node.line, task: node.task });

  for (const child of node.children) {
    getLines(child, result);
  }

  return result;
}

export function toUnscheduledTask(sTask: STask, day: Moment) {
  return {
    isAllDayEvent: true,
    startTime: day,
    durationMinutes: defaultDurationMinutes,
    symbol: sTask.symbol,
    status: sTask.status,
    text: toString(sTask),
    lines: getLines(sTask),
    location: {
      path: sTask.path,
      line: sTask.line,
      position: sTask.position,
    },
    id: getId(),
  };
}

export function toTask(sTask: STask, day: Moment): TaskWithoutComputedDuration {
  const parsedTime = getTimeFromLine({
    line: sTask.text,
    day,
  });

  isNotVoid(
    parsedTime,
    `Unexpectedly received an STask without a timestamp: ${sTask.text}`,
  );

  const { startTime, durationMinutes } = parsedTime;

  return {
    startTime,
    symbol: sTask.symbol,
    status: sTask.status,
    text: toString(sTask),
    lines: getLines(sTask),
    durationMinutes,
    location: {
      path: sTask.path,
      position: sTask.position,
    },
    id: getId(),
  };
}

export function getScheduledDay(sTask: STask): string | undefined {
  if (sTask.scheduled?.toFormat) {
    return sTask.scheduled.toFormat(defaultDayFormatForLuxon);
  }

  const dailyNoteDay = getDateFromPath(sTask.path, "day");
  return dailyNoteDay ? dailyNoteDay.format(defaultDayFormat) : undefined;
}

export function toClockRecord(sTask: STask, clockMoments: ClockMoments) {
  return {
    ...toTime(clockMoments),
    startTime: clockMoments[0],
    text: toString(sTask),
    symbol: "-",
    location: {
      path: sTask.path,
      position: sTask.position,
    },
    id: getId(),
  };
}

export function toMarkdown(sTask: STask): string {
  const baseIndent = "\t".repeat(sTask.position.start.col);
  const extraIndent = " ".repeat(indentBeforeTaskParagraph);

  return sTask.text
    .split("\n")
    .map((line, i) => {
      if (i === 0) {
        // TODO: remove duplication
        return `${baseIndent}${getListTokens(sTask)} ${line}`;
      }

      return `${baseIndent}${extraIndent}${line}`;
    })
    .join("\n");
}

export function getListTokens(task: TaskTokens) {
  const maybeCheckbox = task.status === undefined ? "" : `[${task.status}]`;
  return `${task.symbol} ${maybeCheckbox}`.trim();
}

export function replaceSTaskInFile(contents: string, sTask: STask, newText: string): string {
  const lines = contents.split("\n");
  lines.splice(sTask.position.start.line, sTask.position.end.line - sTask.position.start.line + 1, newText);
  return lines.join("\n");
}
