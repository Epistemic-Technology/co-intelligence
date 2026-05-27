import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import {
  AbstractInputSuggest,
  App,
  normalizePath,
  PluginSettingTab,
  Setting,
  TFile,
  TFolder,
} from "obsidian";
import { ModelId } from "@/types";
import kofiLogo from "@assets/images/kofi.png";

class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(
    app: App,
    private readonly inputEl: HTMLInputElement,
  ) {
    super(app, inputEl);
  }

  protected getSuggestions(query: string): TFolder[] {
    const lower = query.toLowerCase();
    return this.app.vault
      .getAllLoadedFiles()
      .filter((file): file is TFolder => file instanceof TFolder)
      .filter((folder) => folder.path.toLowerCase().includes(lower));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path || "/");
  }

  selectSuggestion(folder: TFolder): void {
    this.inputEl.value = folder.path;
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
}

class FileSuggest extends AbstractInputSuggest<TFile> {
  constructor(
    app: App,
    private readonly inputEl: HTMLInputElement,
    private readonly getFolder: () => string,
  ) {
    super(app, inputEl);
  }

  protected getSuggestions(query: string): TFile[] {
    const lower = query.toLowerCase();
    const folder = this.getFolder();
    const prefix = folder ? folder + "/" : "";
    return this.app.vault
      .getMarkdownFiles()
      .filter((file) => !folder || file.path === folder || file.path.startsWith(prefix))
      .filter((file) => file.path.toLowerCase().includes(lower));
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    this.inputEl.value = file.path;
    this.inputEl.dispatchEvent(new Event("input"));
    this.close();
  }
}

export type ApiKeyProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "perplexity"
  | "tavily";

export const API_KEY_SECRET_IDS: Record<ApiKeyProvider, string> = {
  openai: "coi-openai-api-key",
  anthropic: "coi-anthropic-api-key",
  google: "coi-google-api-key",
  perplexity: "coi-perplexity-api-key",
  tavily: "coi-tavily-api-key",
};

export function getApiKey(app: App, provider: ApiKeyProvider): string {
  return app.secretStorage.getSecret(API_KEY_SECRET_IDS[provider]) ?? "";
}

export function setApiKey(
  app: App,
  provider: ApiKeyProvider,
  value: string,
): void {
  app.secretStorage.setSecret(API_KEY_SECRET_IDS[provider], value);
}

export interface CoIntelligenceSettings {
  defaultFolder: string;
  defaultModel: ModelId | "";
  renamingModel: ModelId | "";
  systemPromptFolder: string;
  defaultSystemPromptNote: string;
}

export const DEFAULT_SETTINGS: CoIntelligenceSettings = {
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

  private addApiKeySetting(
    containerEl: HTMLElement,
    name: string,
    provider: ApiKeyProvider,
  ): void {
    new Setting(containerEl).setName(name).addText((text) => {
      text.inputEl.type = "password";
      text
        .setPlaceholder("Enter API key")
        .setValue(getApiKey(this.app, provider))
        .onChange((value) => setApiKey(this.app, provider, value));
      text.inputEl.addEventListener("blur", () =>
        this.reinitializeAndRefreshDropdowns(),
      );
    });
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    this.addApiKeySetting(containerEl, "OpenAI API key", "openai");
    this.addApiKeySetting(containerEl, "Anthropic API key", "anthropic");
    this.addApiKeySetting(containerEl, "Google API key", "google");
    this.addApiKeySetting(containerEl, "Perplexity API key", "perplexity");
    this.addApiKeySetting(
      containerEl,
      "Tavily API key (web search)",
      "tavily",
    );

    new Setting(containerEl)
      .setName("Default folder")
      .setDesc("Enter the default folder")
      .addText((text) => {
        text
          .setPlaceholder("Enter the default folder")
          .setValue(this.plugin.settings.defaultFolder)
          .onChange((value) => this.saveSetting("defaultFolder", value));
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName("Default model")
      .setDesc("Enter the default model")
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
        new FolderSuggest(this.app, text.inputEl);
      });

    new Setting(containerEl)
      .setName("Default system prompt")
      .setDesc("Enter the path of a note within the system prompt folder")
      .addText((text) => {
        text.setPlaceholder("Leave blank for no default system prompt");
        text.setValue(this.plugin.settings.defaultSystemPromptNote || "");
        text.onChange((value) =>
          this.saveSetting("defaultSystemPromptNote", value),
        );
        new FileSuggest(
          this.app,
          text.inputEl,
          () => this.plugin.settings.systemPromptFolder,
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
    kofiLink.createSpan({
      text: "Support me on ko-fi",
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
    const githubSVG = createSvg("svg");
    githubSVG.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    githubSVG.setAttribute("viewBox", "0 0 24 24");
    githubSVG.setAttribute("fill", "none");
    githubSVG.setAttribute("stroke", "currentColor");
    githubSVG.setAttribute("stroke-width", "2");
    githubSVG.setAttribute("stroke-linecap", "round");
    githubSVG.setAttribute("stroke-linejoin", "round");

    const path1 = createSvg("path");
    path1.setAttribute(
      "d",
      "M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4",
    );

    const path2 = createSvg("path");
    path2.setAttribute("d", "M9 18c-4.51 2-5-2-7-2");

    githubSVG.appendChild(path1);
    githubSVG.appendChild(path2);

    const textDiv = createDiv();
    textDiv.textContent = "Bugs, feedback, help";

    feedbackLink.appendChild(githubSVG);
    feedbackLink.appendChild(textDiv);
  }
}
