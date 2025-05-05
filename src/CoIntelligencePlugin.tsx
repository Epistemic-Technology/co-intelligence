import { Plugin, App, PluginManifest, WorkspaceLeaf, TFile } from "obsidian";
import { render } from "solid-js/web";
import "./styles.css";

import {
  CoIntelligenceSettings,
  CoIntelligenceSettingsTab,
  DEFAULT_SETTINGS,
} from "./settings";

import { NewChatCommand } from "@/commands/new-chat";
import { ChatView, VIEW_TYPE_COI_CHAT } from "@/ChatView";
import { ModelRegistry } from "@/services/model-registry";

import { openCOINote } from "./utils/notes";

export class CoIntelligencePlugin extends Plugin {
  settings: CoIntelligenceSettings;
  registry: ModelRegistry;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.settings = DEFAULT_SETTINGS;
    this.registry = ModelRegistry.getInstance(this);
  }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CoIntelligenceSettingsTab(this.app, this));
    this.addCommand(new NewChatCommand(this));
    this.registerView(
      VIEW_TYPE_COI_CHAT,
      (leaf: WorkspaceLeaf) => new ChatView(leaf, this, this.app),
    );

    this.registerEvent(
      this.app.workspace.on("file-open" as any, this.handleFileOpen.bind(this)),
    );
  }

  private async handleFileOpen(file: TFile) {
    await openCOINote(file, this.app, this.registry);
  }

  async activateView() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// Add default export for Obsidian compatibility
export default CoIntelligencePlugin;
