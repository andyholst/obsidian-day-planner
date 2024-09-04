import type { Moment } from "moment";
import type { CachedMetadata } from "obsidian";
import { dedent } from "ts-dedent";

import { timestampRegExp } from "../regexp";
import type { TaskLocation } from "../types";
import { getId } from "../util/id";

import { parseTimestamp } from "./timestamp/timestamp";

export function getListItemsUnderHeading(
  metadata: CachedMetadata,
  heading: string,
) {
  const { headings, listItems } = metadata;

  if (!headings || !listItems) {
    return [];
  }

  let planHeading, nextHeadingOfSameLevel;
  for (let i = 0; i < headings.length; i++) {
    if (!planHeading && headings[i].heading === heading) {
      planHeading = headings[i];
    } else if (planHeading && headings[i].level <= planHeading.level) {
      nextHeadingOfSameLevel = headings[i];
      break;
    }
  }

  if (!planHeading) {
    return [];
  }

  const { start: planStart } = planHeading.position;
  const nextStart = nextHeadingOfSameLevel?.position.start.line ?? Infinity;

  return listItems.filter(({ position: { start: { line } } }) =>
    line > planStart.line && line < nextStart
  );
}

export function getHeadingByText(metadata: CachedMetadata, text: string) {
  const { headings = [] } = metadata;

  for (let i = 0; i < headings.length; i++) {
    if (headings[i].heading === text) {
      return headings[i];
    }
  }

  return null;
}

export function createTask({
  line,
  completeContent,
  location,
  day,
}: {
  line: string;
  completeContent: string;
  location: TaskLocation;
  day: Moment;
}) {
  const match = timestampRegExp.exec(line.trim());

  if (!match || !match.groups) {
    return null;
  }

  const { listTokens, start, end, text } = match.groups;

  const startTime = parseTimestamp(start, day);
  const endTime = end ? parseTimestamp(end, day) : null;

  return {
    listTokens,
    startTime,
    endTime,
    text: getDisplayedText(match, completeContent),
    firstLineText: text.trim(),
    location,
    id: getId(),
  };
}

function getDisplayedText(
  { groups: { text, listTokens, completion } }: RegExpExecArray,
  completeContent: string,
) {
  const isTask = !!completion?.length;
  const indexOfFirstNewline = completeContent.indexOf("\n");

  if (indexOfFirstNewline < 0) {
    return isTask ? `${listTokens}${text}` : text;
  }

  const linesAfterFirst = completeContent.slice(indexOfFirstNewline + 1);

  if (isTask) {
    return `${listTokens}${text}\n${linesAfterFirst}`;
  }

  return `${text}\n${dedent(linesAfterFirst).trimStart()}`;
}
