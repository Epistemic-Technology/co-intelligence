import { App, Command, TFile, ViewState, Notice } from "obsidian";

import CoIntelligencePlugin from "@/CoIntelligencePlugin";
import { VIEW_TYPE_COI_CHAT } from "@/ChatView";
import { isCoiNote, isActiveCoiNote } from "@/utils/notes";
import { CoiNoteFrontmatter } from "@/types";

export class ToggleChatViewCommand implements Command {
  private app: App;
  private plugin: CoIntelligencePlugin;

  id: string = "toggle-chat-view";
  name: string = "Toggle chat view";

  constructor(plugin: CoIntelligencePlugin) {
    this.plugin = plugin;
    this.app = this.plugin.app;
  }

  checkCallback = (checking: boolean): boolean | void => {
    const currentFile = this.app.workspace.getActiveFile();
    if (checking) {
      if (!currentFile) {
        return false;
      }
      return isCoiNote(currentFile, this.app);
    }

    if (!currentFile) {
      return;
    }

    if (!isCoiNote(currentFile, this.app)) {
      return;
    }

    void this.performToggle(currentFile);
    return;
  };

  private async performToggle(currentFile: TFile) {
    const isCurrentlyActive = isActiveCoiNote(currentFile, this.app);

    await this.app.fileManager.processFrontMatter(
      currentFile,
      (frontmatter) => {
        (frontmatter as CoiNoteFrontmatter)["coi-chat-view"] =
          !isCurrentlyActive;
      },
    );

    await new Promise((resolve) => window.setTimeout(resolve, 200));

    if (isCurrentlyActive) {
      await this.openInDefaultEditor(currentFile);
    } else {
      await this.openInChatView(currentFile);
    }
  }

  private async openInDefaultEditor(_file: TFile) {
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) {
      new Notice("Error: no leaf found while opening chat in default editor");
      console.error("No leaf found while opening chat in default editor");
      return;
    }

    const state = leaf.view.getState();

    await leaf.setViewState(
      {
        type: "markdown",
        state,
        popstate: true,
      } as ViewState,
      { focus: true },
    );
  }

  private async openInChatView(_file: TFile) {
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) {
      new Notice("Error: no leaf found while opening chat in chat view");
      console.error("No leaf found while opening chat in chat view");
      return;
    }

    const state = leaf.view.getState();

    await leaf.setViewState(
      {
        type: VIEW_TYPE_COI_CHAT,
        state,
        popstate: true,
      } as ViewState,
      { focus: true },
    );
  }
}
