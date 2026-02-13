import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import { App, normalizePath, PluginSettingTab, Setting } from "obsidian";
import { ModelId } from "@/types";
import kofiLogo from "@assets/images/kofi.png";

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
  private defaultModelSelect: HTMLSelectElement | null = null;
  private renamingModelSelect: HTMLSelectElement | null = null;
  private systemPromptSelect: HTMLSelectElement | null = null;

  constructor(app: App, plugin: CoIntelligencePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  private async saveSetting(
    settingKey: keyof CoIntelligenceSettings,
    value: string,
  ): Promise<void> {
    if (settingKey.includes("Folder")) {
      value = normalizePath(value);
    }
    (this.plugin.settings as Record<keyof CoIntelligenceSettings, string>)[
      settingKey
    ] = value;
    await this.plugin.saveSettings();
    this.app.workspace.trigger("co-intelligence:settings-changed");
  }

  private reinitializeAndRefreshDropdowns(): void {
    this.plugin.registry?.reinitialize();
    this.refreshDropdowns();
  }

  private refreshDropdowns(): void {
    this.refreshModelDropdown(
      this.defaultModelSelect,
      this.plugin.settings.defaultModel || "",
      false,
    );
    this.refreshModelDropdown(
      this.renamingModelSelect,
      this.plugin.settings.renamingModel || "",
      true,
    );
    this.refreshSystemPromptDropdown();
  }

  private refreshModelDropdown(
    select: HTMLSelectElement | null,
    currentValue: string,
    isRenaming: boolean,
  ): void {
    if (!select) return;

    select.empty();

    const availableModels = this.plugin.registry?.availableModels;

    if (!availableModels || availableModels.length === 0) {
      select.createEl("option", {
        value: "",
        text: "No models available - add API keys first",
      });
    } else {
      if (isRenaming) {
        select.createEl("option", {
          value: "",
          text: "Do not rename notes",
        });
      }
      for (const model of availableModels) {
        if (isRenaming && !model.renaming) continue;
        select.createEl("option", { value: model.id, text: model.name });
      }
    }

    select.value = currentValue;
  }

  private refreshSystemPromptDropdown(): void {
    if (!this.systemPromptSelect) return;

    this.systemPromptSelect.empty();

    const systemPromptFolder = this.plugin.settings.systemPromptFolder;
    const notes = this.app.vault
      .getMarkdownFiles()
      .filter(
        (file) =>
          file.path.startsWith(systemPromptFolder + "/") ||
          file.path === systemPromptFolder,
      );

    this.systemPromptSelect.createEl("option", {
      value: "",
      text: "No default system prompt",
    });

    for (const note of notes) {
      this.systemPromptSelect.createEl("option", {
        value: note.path,
        text: note.basename,
      });
    }

    this.systemPromptSelect.value =
      this.plugin.settings.defaultSystemPromptNote || "";
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("div", {
      text: "⚠️ API keys are stored unencrypted in your vault. Anyone with access to your vault can read them.",
      cls: "coi-settings-security-warning",
    });

    new Setting(containerEl)
      .setName("OpenAI API key")
      .setDesc("Enter your OpenAI API key")
      .addText((text) => {
        text
          .setPlaceholder("Enter your OpenAI API key")
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange((value) => this.saveSetting("openaiApiKey", value));
        text.inputEl.addEventListener("blur", () =>
          this.reinitializeAndRefreshDropdowns(),
        );
      });

    new Setting(containerEl)
      .setName("Anthropic API key")
      .setDesc("Enter your Anthropic API key")
      .addText((text) => {
        text
          .setPlaceholder("Enter your Anthropic API key")
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange((value) => this.saveSetting("anthropicApiKey", value));
        text.inputEl.addEventListener("blur", () =>
          this.reinitializeAndRefreshDropdowns(),
        );
      });

    new Setting(containerEl)
      .setName("Google API key")
      .setDesc("Enter your Google API key")
      .addText((text) => {
        text
          .setPlaceholder("Enter your Google API key")
          .setValue(this.plugin.settings.googleApiKey)
          .onChange((value) => this.saveSetting("googleApiKey", value));
        text.inputEl.addEventListener("blur", () =>
          this.reinitializeAndRefreshDropdowns(),
        );
      });

    new Setting(containerEl)
      .setName("Perplexity API key")
      .setDesc("Enter your Perplexity API key")
      .addText((text) => {
        text
          .setPlaceholder("Enter your Perplexity API key")
          .setValue(this.plugin.settings.perplexityApiKey)
          .onChange((value) => this.saveSetting("perplexityApiKey", value));
        text.inputEl.addEventListener("blur", () =>
          this.reinitializeAndRefreshDropdowns(),
        );
      });

    new Setting(containerEl)
      .setName("Default folder")
      .setDesc("Enter the default folder for CoIntelligence")
      .addText((text) =>
        text
          .setPlaceholder("Enter the default folder for CoIntelligence")
          .setValue(this.plugin.settings.defaultFolder)
          .onChange((value) => this.saveSetting("defaultFolder", value)),
      );

    new Setting(containerEl)
      .setName("Default model")
      .setDesc("Enter the default model for CoIntelligence")
      .addDropdown((dropdown) => {
        this.defaultModelSelect = dropdown.selectEl;

        const availableModels = this.plugin.registry?.availableModels;

        if (!availableModels || availableModels.length === 0) {
          dropdown.addOption("", "No models available - add API keys first");
        } else {
          for (const model of availableModels) {
            dropdown.addOption(model.id, model.name);
          }
        }

        dropdown.setValue(this.plugin.settings.defaultModel || "");
        dropdown.onChange((value) => this.saveSetting("defaultModel", value));
      });

    new Setting(containerEl)
      .setName("Renaming model")
      .setDesc("Enter the model for automatically renaming notes")
      .addDropdown((dropdown) => {
        this.renamingModelSelect = dropdown.selectEl;

        const availableModels = this.plugin.registry?.availableModels;

        if (!availableModels || availableModels.length === 0) {
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
        dropdown.onChange((value) => this.saveSetting("renamingModel", value));
      });

    new Setting(containerEl)
      .setName("System prompt folder")
      .setDesc("Enter the folder path for custom system prompts")
      .addText((text) => {
        text.setPlaceholder("Enter folder for custom system prompts");
        text.setValue(this.plugin.settings.systemPromptFolder || "");
        text.onChange((value) => this.saveSetting("systemPromptFolder", value));
        text.inputEl.addEventListener("blur", () =>
          this.refreshSystemPromptDropdown(),
        );
      });

    new Setting(containerEl)
      .setName("Default system prompt")
      .setDesc("Select note for default system prompt")
      .addDropdown((dropdown) => {
        this.systemPromptSelect = dropdown.selectEl;

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
        dropdown.onChange((value) =>
          this.saveSetting("defaultSystemPromptNote", value),
        );
      });

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
      cls: "coi-sr-only",
    });
    kofiLink.createEl("img", {
      attr: {
        src: kofiLogo,
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
    const githubSVG = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg",
    );
    githubSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    githubSVG.setAttribute("viewBox", "0 0 24 24");
    githubSVG.setAttribute("fill", "none");
    githubSVG.setAttribute("stroke", "currentColor");
    githubSVG.setAttribute("stroke-width", "2");
    githubSVG.setAttribute("stroke-linecap", "round");
    githubSVG.setAttribute("stroke-linejoin", "round");

    const path1 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path1.setAttribute(
      "d",
      "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",
    );

    const path2 = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path",
    );
    path2.setAttribute("d", "M9 18c-4.51 2-5-2-7-2");

    githubSVG.appendChild(path1);
    githubSVG.appendChild(path2);

    const textDiv = document.createElement("div");
    textDiv.textContent = "Bugs, feedback, help";

    feedbackLink.appendChild(githubSVG);
    feedbackLink.appendChild(textDiv);
  }
}
