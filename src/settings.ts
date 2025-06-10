import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import { App, normalizePath, PluginSettingTab, Setting } from "obsidian";
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
      const existingIndex = this.pendingChanges.findIndex(
        (change) => change.settingKey === settingKey,
      );
      if (settingKey.includes("Folder")) {
        value = normalizePath(value);
      }
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

      if (this.debounceTimer) {
        window.clearTimeout(this.debounceTimer);
      }

      this.debounceTimer = window.setTimeout(async () => {
        const changes = [...this.pendingChanges];
        this.pendingChanges = [];
        this.debounceTimer = null;

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

    // Following pattern from https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/src/core/settings.ts
    const callToActionDiv = containerEl.createDiv("coi-settings-cta");
    const feedbackDiv = callToActionDiv.createDiv("coi-settings-feedback");
    const donateDiv = callToActionDiv.createDiv("coi-settings-donate");
    const kofiLink = donateDiv.createEl("a", {
      href: "https://ko-fi.com/epistemictechnology",
      cls: "coi-settings-donate-link",
    });
    const srOnlySpan = kofiLink.createEl("span", {
      text: "Support me on Ko-fi",
      cls: "sr-only",
    });
    kofiLink.createEl("img", {
      attr: {
        src: "https://cdn.ko-fi.com/cdn/kofi1.png?v=3",
        alt: "Buy me a coffee",
        cls: "coi-settings-donate-img",
      },
    });
    const feedbackLink = feedbackDiv.createEl("a", {
      href: "https://github.com/Epistemic-Technology/co-intelligence/issues",
      attr: {
        "aria-label":
          "Report a bug, suggest a feature, offer feedback, or ask a question",
      },
    });
    const githubSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>`;
    feedbackLink.innerHTML = githubSVG + `<div>Bugs, feedback, help<div>`;
    containerEl.createEl("div", {
      text: "⚠️ API keys are stored unencrypted in your vault. Anyone with access to your vault can read them.",
      cls: "coi-settings-security-warning",
    });

    new Setting(containerEl)
      .setName("OpenAI API key")
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
      .setName("Anthropic API key")
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
      .setName("Google API key")
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
      .setName("Perplexity API key")
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
      .setName("Default folder")
      .setDesc("Enter the default folder for CoIntelligence")
      .addText((text) =>
        text
          .setPlaceholder("Enter the default folder for CoIntelligence")
          .setValue(this.plugin.settings.defaultFolder)
          .onChange(this.createDebouncedChangeHandler("defaultFolder")),
      );

    new Setting(containerEl)
      .setName("Default model")
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
      .setName("Renaming model")
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

    new Setting(containerEl)
      .setName("System prompt folder")
      .setDesc("Enter the folder path for custom system prompts")
      .addText((textArea) => {
        textArea.setPlaceholder("Enter folder for custom system prompts");
        textArea.setValue(this.plugin.settings.systemPromptFolder || "");
        textArea.onChange(
          this.createDebouncedChangeHandler("systemPromptFolder", false, true),
        );
      });

    new Setting(containerEl)
      .setName("Default system prompt")
      .setDesc("Select note for default system prompt")
      .addDropdown((dropdown) => {
        const systemPromptFolder = this.plugin.settings.systemPromptFolder;
        const notes = this.app.vault
          .getMarkdownFiles()
          .filter(
            (file) =>
              file.path.startsWith(systemPromptFolder + "/") ||
              file.path === systemPromptFolder,
          );

        dropdown.addOption("", "No default system prompt");

        for (const note of notes) {
          dropdown.addOption(note.path, note.basename);
        }

        dropdown.setValue(this.plugin.settings.defaultSystemPromptNote || "");
        dropdown.onChange(
          this.createDebouncedChangeHandler("defaultSystemPromptNote"),
        );
      });
  }
}
