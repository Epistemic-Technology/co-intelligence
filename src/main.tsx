import { Plugin, App, PluginManifest, WorkspaceLeaf, TFile } from "obsidian";
import { render } from "solid-js/web";
import "./styles.css";

import {
  CoIntelligenceSettings,
  CoIntelligenceSettingsTab,
  DEFAULT_SETTINGS,
} from "./settings";

import { NewChatCommand } from "./commands/new-chat";

import { ChatView, VIEW_TYPE_COI_CHAT } from "./ui/chat-view";

import { isCOINote } from "./utils/notes";

export default class CoIntelligencePlugin extends Plugin {
  settings: CoIntelligenceSettings;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.settings = DEFAULT_SETTINGS;
  }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CoIntelligenceSettingsTab(this.app, this));
    this.addCommand(new NewChatCommand(this));
    this.registerView(
      VIEW_TYPE_COI_CHAT,
      (leaf: WorkspaceLeaf) => new ChatView(leaf),
    );
    this.app.workspace.on("file-open", async (file: TFile) => {
      if (isCOINote(file, this.app)) {
        console.log("COI note opened");
        const leaf = this.app.workspace.getLeaf(true);
        await leaf.openFile(file, { active: true });
        await leaf.setViewState({
          type: VIEW_TYPE_COI_CHAT,
          state: { file: file.path },
          active: true,
        });
      } else {
        console.log("Non-COI note opened");
      }
    });
  }

  onunload() {}

  async activateView() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
