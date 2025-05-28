import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import { App, PluginSettingTab, Setting } from "obsidian";
import { ModelId } from "@/types";

export interface CoIntelligenceSettings {
  openaiApiKey: string;
  anthropicApiKey: string;
  googleApiKey: string;
  perplexityApiKey: string;
  defaultFolder: string;
  defaultModel: ModelId | "";
  renamingModel: ModelId | "";
}

export const DEFAULT_SETTINGS: CoIntelligenceSettings = {
  openaiApiKey: "",
  anthropicApiKey: "",
  googleApiKey: "",
  perplexityApiKey: "",
  defaultFolder: "coi",
  defaultModel: "",
  renamingModel: "",
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

    const securityWarning = containerEl.createEl("div", {
      text: "⚠️ API keys are stored unencrypted in your vault. Anyone with access to your vault can read them.",
      cls: "coi-settings-security-warning",
    });

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
            this.plugin.registry.reinitialize();
            this.display(); // Refresh the settings to update the dropdown
            this.app.workspace.trigger("co-intelligence:settings-changed");
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
            this.plugin.registry.reinitialize();
            this.display(); // Refresh the settings to update the dropdown
            this.app.workspace.trigger("co-intelligence:settings-changed");
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
            this.plugin.registry.reinitialize();
            this.display(); // Refresh the settings to update the dropdown
            this.app.workspace.trigger("co-intelligence:settings-changed");
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
            this.plugin.registry.reinitialize();
            this.display(); // Refresh the settings to update the dropdown
            this.app.workspace.trigger("co-intelligence:settings-changed");
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
            this.app.workspace.trigger("co-intelligence:settings-changed");
          }),
      );

    new Setting(containerEl)
      .setName("Default Model")
      .setDesc("Enter the default model for CoIntelligence")
      .addDropdown((dropdown) => {
        const availableModels = this.plugin.registry.availableModels;

        if (availableModels.length === 0) {
          dropdown.addOption("", "No models available - add API keys first");
        } else {
          for (const model of availableModels) {
            dropdown.addOption(model.id, model.name);
          }
        }

        dropdown.setValue(this.plugin.settings.defaultModel || "");
        dropdown.onChange(async (value) => {
          this.plugin.settings.defaultModel = value as ModelId;
          await this.plugin.saveSettings();
          this.app.workspace.trigger("co-intelligence:settings-changed");
        });
      });

    new Setting(containerEl)
      .setName("Renaming Model")
      .setDesc("Enter the model for automatically renaming notes")
      .addDropdown((dropdown) => {
        const availableModels = this.plugin.registry.availableModels;

        if (availableModels.length === 0) {
          dropdown.addOption("", "No models available - add API keys first");
        } else {
          dropdown.addOption("", "Do not rename notes");
          for (const model of availableModels) {
            if (model.renaming) {
              dropdown.addOption(model.id, model.name);
            }
          }
        }

        dropdown.setValue(this.plugin.settings.renamingModel || "");
        dropdown.onChange(async (value) => {
          this.plugin.settings.renamingModel = value as ModelId;
          await this.plugin.saveSettings();
          this.app.workspace.trigger("co-intelligence:settings-changed");
        });
      });
  }
}
