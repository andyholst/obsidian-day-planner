import type { Moment } from "moment";
import type { CachedMetadata } from "obsidian";
import { dedent } from "ts-dedent";

import { timestampRegExp } from "../regexp";
import { UnscheduledTask } from "../types";
import { getDiffInMinutes } from "../util/moment";
import { getFirstLine, getLinesAfterFirst, removeListTokens } from "../util/task-utils";
import { parseTimestamp } from "./timestamp/timestamp";

export function getListItemsUnderHeading(metadata: CachedMetadata, heading: string) {
  const headings = metadata.headings;
  if (!headings) return [];

  const planHeadingIndex = headings.findIndex((h) => h.heading === heading);
  if (planHeadingIndex === -1) return [];

  const planHeading = headings[planHeadingIndex];
  const nextHeadingOfSameLevel = headings.slice(planHeadingIndex + 1).find((h) => h.level <= planHeading.level);

  return metadata.listItems?.filter((li) => 
    li.position.start.line > planHeading.position.start.line && 
    (!nextHeadingOfSameLevel || li.position.start.line < nextHeadingOfSameLevel.position.start.line)
  ) ?? [];
}

export function getHeadingByText(metadata: CachedMetadata, text: string) {
  return metadata.headings?.find((h) => h.heading === text) ?? null;
}

export function getTimeFromSTask({ line, day }: { line: string; day: Moment }) {
  const match = timestampRegExp.exec(line.trim());
  if (!match) return null;

  const startTime = parseTimestamp(match.groups?.start, day);
  const endTime = parseTimestamp(match.groups?.end, day);

  const durationMinutes = endTime?.isAfter(startTime) ? getDiffInMinutes(endTime, startTime) : undefined;
  return { startTime, durationMinutes };
}

export function getDisplayedText(task: UnscheduledTask) {
  return task.status
    ? task.text
    : `${removeListTokens(getFirstLine(task.text))}\n${dedent(getLinesAfterFirst(task.text)).trimStart()}`;
}
