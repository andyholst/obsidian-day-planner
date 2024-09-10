import { throttle } from "lodash";
import {
  filter as fpFilter,
  flatten as fpFlatten,
  flow as fpFlow,
  groupBy as fpGroupBy,
  mapValues as fpMapValues,
  partition as fpPartition,
} from "lodash/fp";
import { App } from "obsidian";
import { derived, readable, writable, Writable } from "svelte/store";

import { icalRefreshIntervalMillis, reQueryAfterMillis } from "../constants";
import { currentTime } from "../global-store/current-time";
import { DataviewFacade } from "../service/dataview-facade";
import { ObsidianFacade } from "../service/obsidian-facade";
import { PlanEditor } from "../service/plan-editor";
import { DayPlannerSettings } from "../settings";
import { Task, UnscheduledTask } from "../types";
import { useDataviewChange } from "../ui/hooks/use-dataview-change";
import { useDataviewLoaded } from "../ui/hooks/use-dataview-loaded";
import { useDataviewTasks } from "../ui/hooks/use-dataview-tasks";
import { useDateRanges } from "../ui/hooks/use-date-ranges";
import { useDebounceWithDelay } from "../ui/hooks/use-debounce-with-delay";
import { useEditContext } from "../ui/hooks/use-edit/use-edit-context";
import { useIsOnline } from "../ui/hooks/use-is-online";
import { useKeyDown } from "../ui/hooks/use-key-down";
import { useListsFromVisibleDailyNotes } from "../ui/hooks/use-lists-from-visible-daily-notes";
import { useModPressed } from "../ui/hooks/use-mod-pressed";
import { useNewlyStartedTasks } from "../ui/hooks/use-newly-started-tasks";
import { useTasksFromExtraSources } from "../ui/hooks/use-tasks-from-extra-sources";
import { useVisibleDailyNotes } from "../ui/hooks/use-visible-daily-notes";
import { useVisibleDataviewTasks } from "../ui/hooks/use-visible-dataview-tasks";
import { useVisibleDays } from "../ui/hooks/use-visible-days";

import { canHappenAfter, icalEventToTasks } from "./ical";
import { getEarliestMoment } from "./moment";
import { createBackgroundBatchScheduler } from "./scheduler";
import { getUpdateTrigger } from "./store";
import { getDayKey, getEmptyRecordsForDay, mergeTasks } from "./tasks-utils";
import { useIcalEvents } from "./use-ical-events";

interface CreateHooksProps {
  app: App;
  dataviewFacade: DataviewFacade;
  obsidianFacade: ObsidianFacade;
  settingsStore: Writable<DayPlannerSettings>;
  planEditor: PlanEditor;
}

function getDarkModeFlag() {
  return document.body.classList.contains("theme-dark");
}

export function createHooks({
  app,
  dataviewFacade,
  obsidianFacade,
  settingsStore,
  planEditor,
}: CreateHooksProps) {
  const dataviewSource = derived(
    settingsStore,
    ($settings) => $settings.dataviewSource
  );

  const layoutReady = readable(false, (set) => {
    app.workspace.onLayoutReady(() => set(true));
  });

  // Throttling the CSS change listener to 200ms for better performance
  const isDarkMode = readable(getDarkModeFlag(), (set) => {
    const onCssChange = () => set(getDarkModeFlag());
    const throttledCssChange = throttle(onCssChange, 200);
    const eventRef = app.workspace.on("css-change", throttledCssChange);

    return () => {
      app.workspace.offref(eventRef);
    };
  });

  const keyDown = useKeyDown();
  const isModPressed = useModPressed();
  const isOnline = useIsOnline();

  const dataviewChange = useDataviewChange(app.metadataCache);
  const dataviewLoaded = useDataviewLoaded(app);

  const icalRefreshTimer = readable(getUpdateTrigger(), (set) => {
    const interval = setInterval(() => set(getUpdateTrigger()), icalRefreshIntervalMillis);
    return () => clearInterval(interval);
  });

  const icalSyncTrigger = writable();
  const combinedIcalSyncTrigger = derived(
    [icalRefreshTimer, icalSyncTrigger],
    getUpdateTrigger
  );

  const icalEvents = useIcalEvents(
    settingsStore,
    combinedIcalSyncTrigger,
    isOnline
  );

  const dateRanges = useDateRanges();
  const visibleDays = useVisibleDays(dateRanges.ranges);

  const schedulerQueue = derived(
    [icalEvents, visibleDays],
    ([$icalEvents, $visibleDays]) => {
      if (!($icalEvents?.length) || !($visibleDays?.length)) return [];

      const earliestDay = getEarliestMoment($visibleDays);
      const startOfEarliestDay = earliestDay.clone().startOf("day").toDate();

      return $icalEvents
        .filter((icalEvent) => canHappenAfter(icalEvent, startOfEarliestDay))
        .flatMap((icalEvent) =>
          $visibleDays.map((day) => () => icalEventToTasks(icalEvent, day))
        );
    }
  );

  const tasksFromEvents = readable<Array<ReturnType<typeof icalEventToTasks>>>(
    [],
    (set) => {
      const scheduler = createBackgroundBatchScheduler<ReturnType<typeof icalEventToTasks>>(set);
      return schedulerQueue.subscribe(scheduler.enqueueTasks);
    }
  );

  const visibleDayToEventOccurrences = derived(tasksFromEvents, fpFlow(
    fpFilter(Boolean),
    fpFlatten,
    fpGroupBy((task: Task) => getDayKey(task.startTime)),
    fpMapValues((tasks) => {
      const [withTime, noTime]: [Task[], UnscheduledTask[]] = fpPartition(
        (task) => task.startMinutes !== undefined,
        tasks
      );
      return { withTime, noTime };
    })
  ));

  const taskUpdateTrigger = derived([dataviewChange, dataviewSource], getUpdateTrigger);
  
  const debouncedTaskUpdateTrigger = useDebounceWithDelay(
    taskUpdateTrigger,
    keyDown,
    reQueryAfterMillis
  );

  const visibleDailyNotes = useVisibleDailyNotes(
    layoutReady,
    debouncedTaskUpdateTrigger,
    visibleDays
  );

  const listsFromVisibleDailyNotes = useListsFromVisibleDailyNotes(
    visibleDailyNotes,
    debouncedTaskUpdateTrigger,
    dataviewFacade
  );

  const tasksFromExtraSources = useTasksFromExtraSources({
    dataviewSource,
    debouncedTaskUpdateTrigger,
    visibleDailyNotes,
    dataviewFacade,
  });

  const dataviewTasks = useDataviewTasks({
    listsFromVisibleDailyNotes,
    tasksFromExtraSources,
    settingsStore,
  });

  const visibleDataviewTasks = useVisibleDataviewTasks(
    dataviewTasks,
    visibleDays
  );

  const visibleTasks = derived(
    [visibleDataviewTasks, visibleDayToEventOccurrences],
    ([$visibleDataviewTasks, $visibleDayToEventOccurrences]) =>
      mergeTasks($visibleDataviewTasks, $visibleDayToEventOccurrences)
  );

  const tasksForToday = derived(
    [visibleTasks, currentTime],
    ([$visibleTasks, $currentTime]) =>
      $visibleTasks[getDayKey($currentTime)] || getEmptyRecordsForDay()
  );

  const editContext = useEditContext({
    obsidianFacade,
    onUpdate: planEditor.syncTasksWithFile,
    settings: settingsStore,
    visibleTasks,
  });

  const newlyStartedTasks = useNewlyStartedTasks({
    settings: settingsStore,
    tasksForToday,
    currentTime,
  });

  return {
    editContext,
    tasksForToday,
    visibleTasks,
    dataviewLoaded,
    newlyStartedTasks,
    isModPressed,
    icalSyncTrigger,
    isOnline,
    isDarkMode,
    dateRanges,
  };
}
