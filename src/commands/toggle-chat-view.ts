import { App, Command, TFile, ViewState, Notice } from "obsidian";

import CoIntelligencePlugin from "@/CoIntelligencePlugin";
import { VIEW_TYPE_COI_CHAT } from "@/ChatView";
import { isCoiNote, isActiveCoiNote } from "@/utils/notes";

export class ToggleChatViewCommand implements Command {
  private app: App;
  private plugin: CoIntelligencePlugin;

  id: string = "toggle-chat-view";
  name: string = "Toggle Chat View";

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

    this.performToggle(currentFile);
    return;
  };

  private async performToggle(currentFile: TFile) {
    const isCurrentlyActive = isActiveCoiNote(currentFile, this.app);

    await this.app.fileManager.processFrontMatter(
      currentFile,
      (frontmatter) => {
        frontmatter["coi-chat-view"] = !isCurrentlyActive;
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 200));

    if (isCurrentlyActive) {
      await this.openInDefaultEditor(currentFile);
    } else {
      await this.openInChatView(currentFile);
    }
  }

  private async openInDefaultEditor(file: TFile) {
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) {
      new Notice("Error: No leaf found while opening chat in default editor");
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

  private async openInChatView(file: TFile) {
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) {
      new Notice("Error: No leaf found while opening chat in chat view");
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
