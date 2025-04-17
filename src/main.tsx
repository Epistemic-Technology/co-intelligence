import { Plugin, App, PluginManifest } from "obsidian";
import { render } from "solid-js/web";
import "./styles.css";

import {
  CoIntelligenceSettings,
  CoIntelligenceSettingsTab,
  DEFAULT_SETTINGS,
} from "./settings";

export default class CoIntelligencePlugin extends Plugin {
  settings: CoIntelligenceSettings;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.settings = DEFAULT_SETTINGS;
  }

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new CoIntelligenceSettingsTab(this.app, this));
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
