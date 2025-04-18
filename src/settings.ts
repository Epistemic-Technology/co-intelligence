import type CoIntelligencePlugin from "src/main";
import { App, PluginSettingTab, Setting } from "obsidian";

export interface CoIntelligenceSettings {
  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey: string;
  perplexityApiKey: string;
  defaultFolder: string;
}

export const DEFAULT_SETTINGS: CoIntelligenceSettings = {
  openaiApiKey: "",
  anthropicApiKey: "",
  googleApiKey: "",
  perplexityApiKey: "",
  defaultFolder: "coi",
};

export class CoIntelligenceSettingsTab extends PluginSettingTab {
  plugin: CoIntelligencePlugin;

  constructor(app: App, plugin: CoIntelligencePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    new Setting(containerEl)
      .setName("OpenAI API Key")
      .setDesc("Enter your OpenAI API key")
      .addText((text) =>
        text
          .setPlaceholder("Enter your OpenAI API key")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Anthropic API Key")
      .setDesc("Enter your Anthropic API key")
      .addText((text) =>
        text
          .setPlaceholder("Enter your Anthropic API key")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Google API Key")
      .setDesc("Enter your Google API key")
      .addText((text) =>
        text
          .setPlaceholder("Enter your Google API key")
          .setValue(this.plugin.settings.googleApiKey)
          .onChange(async (value) => {
            this.plugin.settings.googleApiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Perplexity API Key")
      .setDesc("Enter your Perplexity API key")
      .addText((text) =>
        text
          .setPlaceholder("Enter your Perplexity API key")
          .setValue(this.plugin.settings.perplexityApiKey)
          .onChange(async (value) => {
            this.plugin.settings.perplexityApiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Default Folder")
      .setDesc("Enter the default folder for CoIntelligence")
      .addText((text) =>
        text
          .setPlaceholder("Enter the default folder for CoIntelligence")
          .setValue(this.plugin.settings.defaultFolder)
          .onChange(async (value) => {
            this.plugin.settings.defaultFolder = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
