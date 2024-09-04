import { flow } from "lodash/fp";
import { STask } from "obsidian-dataview";
import { isNotVoid } from "typed-assert";

import {
  withActiveClock,
  withActiveClockCompleted,
  withoutActiveClock,
} from "../util/clock";
import { replaceSTaskInFile, toMarkdown } from "../util/dataview";
import { locToEditorPosition } from "../util/editor";
import { withNotice } from "../util/with-notice";

import { DataviewFacade } from "./dataview-facade";
import { ObsidianFacade } from "./obsidian-facade";

export class STaskEditor {
  constructor(
    private readonly obsidianFacade: ObsidianFacade,
    private readonly dataviewFacade: DataviewFacade,
  ) {}

  clockOut = withNotice(async (sTask: STask) => {
    const updatedMarkdown = toMarkdown(withActiveClockCompleted(sTask));
    await this.obsidianFacade.editFile(sTask.path, (contents) =>
      replaceSTaskInFile(contents, sTask, updatedMarkdown),
    );
  });

  cancelClock = withNotice(async (sTask: STask) => {
    const updatedMarkdown = toMarkdown(withoutActiveClock(sTask));
    await this.obsidianFacade.editFile(sTask.path, (contents) =>
      replaceSTaskInFile(contents, sTask, updatedMarkdown),
    );
  });

  private replaceSTaskUnderCursor = (newMarkdown: string) => {
    const view = this.obsidianFacade.getActiveMarkdownView();
    const sTask = this.getSTaskUnderCursorFromLastView();

    view.editor.replaceRange(
      newMarkdown,
      locToEditorPosition(sTask.position.start),
      locToEditorPosition(sTask.position.end),
    );
  };

  private getSTaskUnderCursorFromLastView = (): STask => {
    const location = this.obsidianFacade.getLastCaretLocation();
    const sTask = this.dataviewFacade.getTaskFromCaretLocation(location);

    isNotVoid(sTask, "No task under cursor");
    return sTask;
  };

  clockInUnderCursor = withNotice(() => {
    const sTask = this.getSTaskUnderCursorFromLastView();
    const updatedMarkdown = toMarkdown(withActiveClock(sTask));
    this.replaceSTaskUnderCursor(updatedMarkdown);
  });

  clockOutUnderCursor = withNotice(() => {
    const sTask = this.getSTaskUnderCursorFromLastView();
    const updatedMarkdown = toMarkdown(withActiveClockCompleted(sTask));
    this.replaceSTaskUnderCursor(updatedMarkdown);
  });

  cancelClockUnderCursor = withNotice(() => {
    const sTask = this.getSTaskUnderCursorFromLastView();
    const updatedMarkdown = toMarkdown(withoutActiveClock(sTask));
    this.replaceSTaskUnderCursor(updatedMarkdown);
  });
}
