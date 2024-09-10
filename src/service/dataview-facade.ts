import { App } from "obsidian";
import { getAPI, STask } from "obsidian-dataview";

export class DataviewFacade {
  private readonly api = getAPI(this.app);

  constructor(private readonly app: App) {}

  getAllTasksFrom = (source: string) => {
    return this.api?.pages(source)?.file?.tasks?.array() ?? [];
  };

  getAllListsFrom = (source: string) => {
    return this.api?.pages(source)?.file?.lists?.array() ?? [];
  };

  getTaskFromCaretLocation = ({ path, line }: { path: string; line: number }) => {
    return this.getTasksFromPath(path)?.find((sTask: STask) => sTask.line === line) ?? null;
  };

  private getTasksFromPath = (path: string): STask[] | undefined => {
    return this.api?.page(path)?.file?.tasks;
  };
}
