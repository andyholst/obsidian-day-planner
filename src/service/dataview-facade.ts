import { App } from "obsidian";
import { getAPI, STask } from "obsidian-dataview";
import { writable } from "svelte/store";

export class DataviewFacade {
  // TODO: There is a separate store for this, consider removing this store in future refactoring.
  readonly dataviewLoaded = writable(false);

  constructor(private readonly app: App) {}

  getAllTasksFrom(source: string): STask[] {
    const dataview = this.getDataview();
    if (!dataview) return [];

    const pages = dataview.pages(source);
    return pages?.file?.tasks?.array() || [];
  }

  getAllListsFrom(source: string) {
    const dataview = this.getDataview();
    if (!dataview) return [];

    const pages = dataview.pages(source);
    return pages?.file?.lists?.array() || [];
  }

  getTaskFromCaretLocation({ path, line }: { path: string; line: number }) {
    const tasks = this.getTasksFromPath(path);
    return tasks?.find((sTask: STask) => sTask.line === line);
  }

  private getTasksFromPath(path: string): STask[] | undefined {
    const dataview = getAPI(this.app);
    return dataview?.page(path)?.file?.tasks;
  }

  private getDataview() {
    const dataview = getAPI(this.app);
    const isLoaded = !!dataview;

    this.dataviewLoaded.update((loaded) => {
      if (loaded !== isLoaded) {
        return isLoaded;
      }
      return loaded;
    });

    return dataview;
  }
}
