import ical from "node-ical";
import { request } from "obsidian";
import { derived, Readable } from "svelte/store";

import { DayPlannerSettings } from "../settings";
import { WithIcalConfig } from "../types";

function isVEvent(event: ical.CalendarComponent): event is ical.VEvent {
  return event.type === "VEVENT";
}

export function useIcalEvents(
  settings: Readable<DayPlannerSettings>,
  syncTrigger: Readable<unknown>,
  isOnline: Readable<boolean>,
) {
  const previousFetches = new Map<string, Array<WithIcalConfig<ical.VEvent>>>();

  return derived(
    [settings, isOnline, syncTrigger],
    ([$settings, $isOnline], set: (events: Array<WithIcalConfig<ical.VEvent>>) => void) => {
      if (!$isOnline) {
        return;
      }

      const calendarPromises = $settings.icals
        .filter((ical) => ical.url.trim().length > 0)
        .map((calendar) => {
          if (previousFetches.has(calendar.url)) {
            return Promise.resolve(previousFetches.get(calendar.url)!);
          }

          return request({ url: calendar.url })
            .then((response) => {
              const parsed = ical.parseICS(response);
              const veventsWithCalendar = Object.values(parsed)
                .filter(isVEvent)
                .map((icalEvent) => ({
                  ...icalEvent,
                  calendar,
                }));

              previousFetches.set(calendar.url, veventsWithCalendar);
              return veventsWithCalendar;
            })
            .catch((error) => {
              console.error(`Failed to fetch iCal from ${calendar.url}:`, error);
              return previousFetches.get(calendar.url) || [];
            });
        });

      Promise.all(calendarPromises).then((calendars) => {
        const allEvents = calendars.flat();
        set(allEvents);
      });
    },
    []
  );
}
