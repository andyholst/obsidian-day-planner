import { Moment } from "moment/moment";
import { getDateFromPath } from "obsidian-daily-notes-interface";
import { DataArray, DateTime, STask } from "obsidian-dataview";
import { defaultDayFormat, defaultDayFormatForLuxon, defaultDurationMinutes, indentBeforeTaskParagraph } from "../constants";
import { createTask } from "../parser/parser";
import { timeFromStartRegExp } from "../regexp";
import { Task } from "../types";
import { ClockMoments, toTime } from "./clock";
import { getId } from "./id";
import { getDiffInMinutes, getMinutesSinceMidnight } from "./moment";
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

export function toString(node: Node, indentation = ""): string {
  let result = `${indentation}${textToString(node)}`;
  const childIndentation = `\t${indentation}`;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (!child.scheduled && !timeFromStartRegExp.test(child.text)) {
      result += toString(child, childIndentation);
    }
  }

  return result;
}

export function toUnscheduledTask(sTask: STask, day: Moment) {
  return {
    durationMinutes: defaultDurationMinutes,
    listTokens: getListTokens(sTask),
    firstLineText: sTask.text,
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
  const taskData = createTask({
    line: textToString(sTask),
    completeContent: toString(sTask),
    day,
    location: {
      path: sTask.path,
      line: sTask.line,
      position: sTask.position,
    },
  });

  const durationMinutes = taskData.endTime?.isAfter(taskData.startTime)
    ? getDiffInMinutes(taskData.endTime, taskData.startTime)
    : undefined;

  return {
    startTime: taskData.startTime,
    listTokens: getListTokens(sTask),
    firstLineText: taskData.firstLineText,
    text: taskData.text,
    durationMinutes,
    startMinutes: getMinutesSinceMidnight(taskData.startTime),
    location: {
      path: sTask.path,
      line: sTask.line,
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
    firstLineText: textToString(sTask),
    text: toString(sTask),
    listTokens: "",
    location: {
      path: sTask.path,
      line: sTask.line,
      position: sTask.position,
    },
    id: getId(),
  };
}

export function toMarkdown(sTask: STask): string {
  const baseIndent = "\t".repeat(sTask.position.start.col);
  const extraIndent = " ".repeat(indentBeforeTaskParagraph);

  return sTask.text.split("\n").map((line, i) => {
    return i === 0 ? `${baseIndent}${getListTokens(sTask)}${line}` : `${baseIndent}${extraIndent}${line}`;
  }).join("\n");
}

function getListTokens(sTask: STask): string {
  const maybeCheckbox = sTask.status !== undefined ? `[${sTask.status}] ` : "";
  return `${sTask.symbol} ${maybeCheckbox}`;
}

export function replaceSTaskInFile(contents: string, sTask: STask, newText: string): string {
  const lines = contents.split("\n");
  lines.splice(sTask.position.start.line, sTask.position.end.line - sTask.position.start.line + 1, newText);
  return lines.join("\n");
}
