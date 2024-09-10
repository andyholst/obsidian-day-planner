import { Moment } from "moment/moment";
import { getDateFromPath } from "obsidian-daily-notes-interface";
import { DataArray, DateTime, STask } from "obsidian-dataview";

import {
  defaultDayFormat,
  defaultDayFormatForLuxon,
  defaultDurationMinutes,
  indentBeforeTaskParagraph,
} from "../constants";
import { getTimeFromSTask } from "../parser/parser";
import { timeFromStartRegExp } from "../regexp";
import { Task, TaskTokens } from "../types";

import { ClockMoments, toTime } from "./clock";
import { getId } from "./id";
import { getMinutesSinceMidnight } from "./moment";
import { deleteProps } from "./properties";

export function unwrap<T>(group: ReturnType<DataArray<T>["groupBy"]>) {
  return group.map(({ key, rows }) => [key, rows.array()]).array();
}

interface Node {
  text: string;
  symbol: string;
  children: Node[];
  status?: string;
  scheduled?: DateTime;
}

export function textToString(node: Node) {
  const statusText = node.status ? `[${node.status}] ` : "";
  return `${node.symbol} ${statusText}${deleteProps(node.text)}\n`;
}

export function toString(node: Node, indentation = ""): string {
  let result = `${indentation}${textToString(node)}`;

  for (const child of node.children) {
    if (!child.scheduled && !timeFromStartRegExp.test(child.text)) {
      result += toString(child, `\t${indentation}`);
    }
  }

  return result;
}

export function toUnscheduledTask(sTask: STask, day: Moment): Task {
  return {
    durationMinutes: defaultDurationMinutes,
    symbol: sTask.symbol,
    status: sTask.status,
    text: toString(sTask),
    location: {
      path: sTask.path,
      line: sTask.line,
      position: sTask.position,
    },
    id: getId(),
  };
}

export function toTask(sTask: STask, day: Moment): Task {
  const { startTime, durationMinutes } = getTimeFromSTask({ line: sTask.text, day });

  return {
    startTime,
    symbol: sTask.symbol,
    status: sTask.status,
    text: toString(sTask),
    durationMinutes,
    startMinutes: getMinutesSinceMidnight(startTime),
    location: {
      path: sTask.path,
      position: sTask.position,
    },
    id: getId(),
  };
}

export function getScheduledDay(sTask: STask) {
  const scheduledPropDay = sTask.scheduled?.toFormat?.(defaultDayFormatForLuxon);
  const dailyNoteDay = getDateFromPath(sTask.path, "day")?.format(defaultDayFormat);

  return scheduledPropDay || dailyNoteDay;
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
    .map((line, i) =>
      i === 0
        ? `${baseIndent}${getListTokens(sTask)} ${line}`
        : `${baseIndent}${extraIndent}${line}`
    )
    .join("\n");
}

export function getListTokens(task: TaskTokens): string {
  const checkbox = task.status !== undefined ? `[${task.status}]` : "";
  return `${task.symbol} ${checkbox}`.trim();
}

export function replaceSTaskInFile(contents: string, sTask: STask, newText: string): string {
  const lines = contents.split("\n");
  const { start, end } = sTask.position;

  // Calculate the number of lines to delete based on the task's position
  const deleteCount = end.line - start.line + 1;

  lines.splice(start.line, deleteCount, newText);

  return lines.join("\n");
}
