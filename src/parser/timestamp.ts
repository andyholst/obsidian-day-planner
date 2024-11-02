import type { Moment } from "moment/moment";

import { timeRegExp } from "../regexp";

export function parseTimestamp(asText: string, day: Moment) {
  const result = timeRegExp.exec(asText);

  if (!result) {
    throw new Error(`${asText} is not a valid timestamp`);
  }

  let parsedHours = parseInt(result[1]);

  if (isNaN(parsedHours)) {
    throw new Error(`${asText} is not a valid timestamp`);
  }

  const parsedMinutes = parseInt(result[2]) || 0;
  const ampm = result[3]?.toLowerCase();

  if (ampm?.toLowerCase().trim() === "pm" && parsedHours < 12) {
    parsedHours += 12;
  }

  if (ampm?.toLowerCase().trim() === "am" && parsedHours === 12) {
    parsedHours = 0;
  }

  const timeOfDay = window.moment.duration({
    hours: parsedHours,
    minutes: parsedMinutes,
  });

  return day?.clone().startOf("day").add(timeOfDay) || null;
}
