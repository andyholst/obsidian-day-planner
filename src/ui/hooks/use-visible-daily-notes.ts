import { Moment } from "moment";
import { Notice } from "obsidian";
import { getAllDailyNotes, getDailyNote } from "obsidian-daily-notes-interface";
import { derived, Readable } from "svelte/store";

function getAllDailyNotesSafely() {
  try {
    return getAllDailyNotes();
  } catch (error) {
    console.error(error);

    new Notice(
      `Could not read daily notes. Reason: ${error?.message || error}`,
    );

    return {};
  }
}

/**
 *
 * @param layoutReady used as a proxy that lets us know when the vault is ready to be queried for daily notes
 * @param debouncedTaskUpdateTrigger lets us know when some files changed, and we need to re-run
 * @param visibleDays
 */
export function useVisibleDailyNotes(
  layoutReady: Readable<boolean>,
  debouncedTaskUpdateTrigger: Readable<unknown>,
  visibleDays: Readable<Moment[]>,
) {
  return derived(
    [layoutReady, visibleDays, debouncedTaskUpdateTrigger],
    ([$layoutReady, $visibleDays]) => {
      if (!$layoutReady) {
        return [];
      }

      return $visibleDays
        .map((day) => getDailyNote(day, getAllDailyNotesSafely()))
        .filter(Boolean);
    },
  );
}
