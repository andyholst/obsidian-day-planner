import type { Moment } from "moment/moment";
import { timeRegExp } from "../../regexp";

export function parseTimestamp(asText?: string, day?: Moment): Moment | null {
  if (!asText) {
    return null;
  }

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

  if (ampm === "pm" && parsedHours < 12) {
    parsedHours += 12;
  } else if (ampm === "am" && parsedHours === 12) {
    parsedHours = 0; // Correct 12 AM to 0 hours (midnight)
  }

  const timeOfDay = { hours: parsedHours, minutes: parsedMinutes };

  return day?.clone().startOf("day").add(timeOfDay) || null;
}
