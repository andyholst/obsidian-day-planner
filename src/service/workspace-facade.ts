import type { Moment } from "moment/moment";
import {
  FileView,
  MarkdownView,
  TFile,
  Workspace,
  WorkspaceLeaf,
} from "obsidian";
import {
  createDailyNote,
  getAllDailyNotes,
  getDailyNote,
} from "obsidian-daily-notes-interface";
import { isInstanceOf, isNotVoid } from "typed-assert";

import type { VaultFacade } from "./vault-facade";

function doesLeafContainFile(leaf: WorkspaceLeaf, file: TFile) {
  return leaf.view instanceof FileView && leaf.view.file === file;
}

export class WorkspaceFacade {
  constructor(
    private readonly workspace: Workspace,
    private readonly vaultFacade: VaultFacade,
  ) {}

  async openFileInEditor(file: TFile) {
    const leafWithThisFile = this.workspace
      .getLeavesOfType("markdown")
      .find((leaf) => doesLeafContainFile(leaf, file));

    if (leafWithThisFile) {
      this.workspace.setActiveLeaf(leafWithThisFile, { focus: true });

      if (leafWithThisFile.view instanceof MarkdownView) {
        return leafWithThisFile.view.editor;
      }
    } else {
      const newLeaf = this.workspace.getLeaf(false);

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

  getActiveMarkdownView = () => {
    const view = this.workspace.getMostRecentLeaf()?.view;

    isInstanceOf(view, MarkdownView, "No markdown editor is active");
    return view;
  };

  async revealLineInFile(path: string, line: number) {
    const file = this.vaultFacade.getFileByPath(path);

    const editor = await this.openFileInEditor(file);

    if (!editor) {
      return;
    }

    this.workspace
      .getActiveViewOfType(MarkdownView)
      ?.setEphemeralState({ line });

    editor.setCursor({ line, ch: editor.getLine(line).length });
  }

  private async activateLeaf(leaf: WorkspaceLeaf) {
    await this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  private getEditorFromLeaf(leaf: WorkspaceLeaf) {
    return leaf.view instanceof MarkdownView ? leaf.view.editor : null;
  }
}
