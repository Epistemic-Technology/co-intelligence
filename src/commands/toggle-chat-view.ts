import { App, Command, TFile, ViewState } from "obsidian";

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

  callback = async () => {
    const currentFile = this.app.workspace.getActiveFile();
    if (!currentFile) {
      return;
    }

    if (!isCoiNote(currentFile, this.app)) {
      return;
    }

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
  };

  private async openInDefaultEditor(file: TFile) {
    const leaf = this.app.workspace.getMostRecentLeaf();
    if (!leaf) {
      console.error("No leaf found");
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
      console.error("No leaf found");
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
