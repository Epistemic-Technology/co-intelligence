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
  systemPromptFolder: string;
  defaultSystemPromptNote: string;
}

export const DEFAULT_SETTINGS: CoIntelligenceSettings = {
  openaiApiKey: "",
  anthropicApiKey: "",
  googleApiKey: "",
  perplexityApiKey: "",
  defaultFolder: "coi",
  defaultModel: "",
  renamingModel: "",
  systemPromptFolder: "coi/prompts",
  defaultSystemPromptNote: "",
};

export class CoIntelligenceSettingsTab extends PluginSettingTab {
  plugin: CoIntelligencePlugin;
  private debounceTimer: number | null = null;
  private pendingChanges: {
    settingKey: keyof CoIntelligenceSettings;
    value: string;
    shouldReinitialize: boolean;
    shouldRefreshDisplay: boolean;
  }[] = [];

  constructor(app: App, plugin: CoIntelligencePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private createDebouncedChangeHandler(
    settingKey: keyof CoIntelligenceSettings,
    shouldReinitialize = false,
    shouldRefreshDisplay = false,
  ) {
    return async (value: string) => {
      // Update pending changes
      const existingIndex = this.pendingChanges.findIndex(
        (change) => change.settingKey === settingKey,
      );
      if (existingIndex >= 0) {
        this.pendingChanges[existingIndex] = {
          settingKey,
          value,
          shouldReinitialize,
          shouldRefreshDisplay,
        };
      } else {
        this.pendingChanges.push({
          settingKey,
          value,
          shouldReinitialize,
          shouldRefreshDisplay,
        });
      }

      // Clear existing timer
      if (this.debounceTimer) {
        window.clearTimeout(this.debounceTimer);
      }

      // Set new timer
      this.debounceTimer = window.setTimeout(async () => {
        const changes = [...this.pendingChanges];
        this.pendingChanges = [];
        this.debounceTimer = null;

        // Apply all pending changes
        let needsReinitialize = false;
        let needsRefreshDisplay = false;

        for (const change of changes) {
          (this.plugin.settings as any)[change.settingKey] = change.value;
          if (change.shouldReinitialize) needsReinitialize = true;
          if (change.shouldRefreshDisplay) needsRefreshDisplay = true;
        }

        await this.plugin.saveSettings();

        if (needsReinitialize) {
          this.plugin.registry.reinitialize();
        }

        if (needsRefreshDisplay) {
          this.displayWithFocusPreservation();
        }

        this.app.workspace.trigger("co-intelligence:settings-changed");
      }, 500);
    };
  }

  private displayWithFocusPreservation(): void {
    // Store focus information
    const activeElement = document.activeElement as HTMLInputElement;
    let focusedPlaceholder: string | null = null;
    let cursorPosition: number | null = null;

    if (activeElement && activeElement.placeholder) {
      focusedPlaceholder = activeElement.placeholder;
      cursorPosition = activeElement.selectionStart;
    }

    // Refresh the display
    this.display();

    // Restore focus after a brief delay to allow DOM to update
    if (focusedPlaceholder) {
      setTimeout(() => {
        const inputs = this.containerEl.querySelectorAll(
          "input[placeholder]",
        ) as NodeListOf<HTMLInputElement>;
        for (const input of inputs) {
          if (input.placeholder === focusedPlaceholder) {
            input.focus();
            if (cursorPosition !== null) {
              input.setSelectionRange(cursorPosition, cursorPosition);
            }
            break;
          }
        }
      }, 10);
    }
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
          .onChange(
            this.createDebouncedChangeHandler("openaiApiKey", true, true),
          ),
      );

    new Setting(containerEl)
      .setName("Anthropic API Key")
      .setDesc("Enter your Anthropic API key")
      .addText((text) =>
        text
          .setPlaceholder("Enter your Anthropic API key")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(
            this.createDebouncedChangeHandler("anthropicApiKey", true, true),
          ),
      );

    new Setting(containerEl)
      .setName("Google API Key")
      .setDesc("Enter your Google API key")
      .addText((text) =>
        text
          .setPlaceholder("Enter your Google API key")
          .setValue(this.plugin.settings.googleApiKey)
          .onChange(
            this.createDebouncedChangeHandler("googleApiKey", true, true),
          ),
      );

    new Setting(containerEl)
      .setName("Perplexity API Key")
      .setDesc("Enter your Perplexity API key")
      .addText((text) =>
        text
          .setPlaceholder("Enter your Perplexity API key")
          .setValue(this.plugin.settings.perplexityApiKey)
          .onChange(
            this.createDebouncedChangeHandler("perplexityApiKey", true, true),
          ),
      );

    new Setting(containerEl)
      .setName("Default Folder")
      .setDesc("Enter the default folder for CoIntelligence")
      .addText((text) =>
        text
          .setPlaceholder("Enter the default folder for CoIntelligence")
          .setValue(this.plugin.settings.defaultFolder)
          .onChange(this.createDebouncedChangeHandler("defaultFolder")),
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
        dropdown.onChange(this.createDebouncedChangeHandler("defaultModel"));
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
        dropdown.onChange(this.createDebouncedChangeHandler("renamingModel"));
      });
  }
}
