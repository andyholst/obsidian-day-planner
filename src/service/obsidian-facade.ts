import type { Moment } from "moment/moment";
import { App, FileView, MarkdownView, TFile, WorkspaceLeaf } from "obsidian";
import {
  createDailyNote,
  getAllDailyNotes,
  getDailyNote,
} from "obsidian-daily-notes-interface";
import { isInstanceOf, isNotVoid } from "typed-assert";

function doesLeafContainFile(leaf: WorkspaceLeaf, file: TFile) {
  return leaf.view instanceof FileView && leaf.view.file === file;
}

export class ObsidianFacade {
  constructor(readonly app: App) {}

  async openFileInEditor(file: TFile) {
    const markdownLeaves = this.app.workspace.getLeavesOfType("markdown");
    const leafWithThisFile = markdownLeaves.find((leaf) =>
      doesLeafContainFile(leaf, file)
    );

    if (leafWithThisFile) {
      await this.activateLeaf(leafWithThisFile);
      return this.getEditorFromLeaf(leafWithThisFile);
    } else {
      const newLeaf = this.app.workspace.getLeaf(false);
      await newLeaf.openFile(file);
      return this.getEditorFromLeaf(newLeaf);
    }
  }

  getLastCaretLocation() {
    const view = this.getActiveMarkdownView();
    const file = view.file;

    isNotVoid(file, "There is no file in view");

    return { path: file.path, line: view.editor.getCursor().line };
  }

  async openFileForDay(moment: Moment) {
    const allDailyNotes = getAllDailyNotes();
    const dailyNote = getDailyNote(moment, allDailyNotes) || (await createDailyNote(moment));
    return this.openFileInEditor(dailyNote);
  }

  getActiveMarkdownView() {
    const view = this.app.workspace.getMostRecentLeaf()?.view;
    isInstanceOf(view, MarkdownView, "No markdown editor is active");
    return view;
  }

  getMetadataForPath(path: string) {
    const file = this.getFileByPath(path);
    return this.app.metadataCache.getFileCache(file);
  }

  async revealLineInFile(path: string, line: number) {
    const file = this.getFileByPath(path);
    const editor = await this.openFileInEditor(file);
    this.app.workspace
      .getActiveViewOfType(MarkdownView)
      ?.setEphemeralState({ line });

    editor.setCursor({ line, ch: 0 });
  }

  async editFile(path: string, editFn: (contents: string) => string) {
    const file = this.getFileByPath(path);
    const contents = await this.app.vault.read(file);
    const newContents = editFn(contents);
    await this.app.vault.modify(file, newContents);
  }

  private getFileByPath(path: string) {
    const file = this.app.vault.getAbstractFileByPath(path);
    isInstanceOf(file, TFile, `Unable to open file: ${path}`);
    return file;
  }

  private async activateLeaf(leaf: WorkspaceLeaf) {
    await this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  private getEditorFromLeaf(leaf: WorkspaceLeaf) {
    return leaf.view instanceof MarkdownView ? leaf.view.editor : null;
  }
}
