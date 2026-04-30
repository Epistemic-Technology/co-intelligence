import {
  Plugin,
  App,
  PluginManifest,
  WorkspaceLeaf,
  TFile,
  ViewState,
  Menu,
  TAbstractFile,
} from "obsidian";
import { around } from "monkey-around";

import {
  ApiKeyProvider,
  CoIntelligenceSettings,
  CoIntelligenceSettingsTab,
  DEFAULT_SETTINGS,
  setApiKey,
} from "./settings";

import { NewChatCommand } from "@/commands/new-chat";
import { ToggleChatViewCommand } from "@/commands/toggle-chat-view";
import { ChatView, VIEW_TYPE_COI_CHAT } from "@/ChatView";
import { ModelRegistry } from "@/services/model-registry";

import {
  isCoiNote,
  isPathActiveCoiNote,
  createCOINote,
  isActiveCoiNote,
  waitForMetadataCache,
} from "./utils/notes";

export class CoIntelligencePlugin extends Plugin {
  settings: CoIntelligenceSettings;
  registry: ModelRegistry | undefined;
  public isPerformingAutomaticRename: boolean = false;

  constructor(app: App, manifest: PluginManifest) {
    super(app, manifest);
    this.settings = DEFAULT_SETTINGS;
  }

  async onload() {
    await this.loadSettings();
    this.registry = ModelRegistry.getInstance(this);
    this.addSettingTab(new CoIntelligenceSettingsTab(this.app, this));
    this.addCommand(new NewChatCommand(this));
    this.addCommand(new ToggleChatViewCommand(this));
    this.registerView(
      VIEW_TYPE_COI_CHAT,
      (leaf: WorkspaceLeaf) => new ChatView(leaf, this, this.app),
    );

    this.addRibbonIcon("bot-message-square", "New chat", () => {
      void createCOINote(this.app, this);
    });
    this.registerEvent(
      this.app.workspace.on("file-open", this.handleFileOpen.bind(this)),
    );
    this.registerEvent(
      this.app.vault.on("rename", this.handleFileRename.bind(this)),
    );
    this.registerEvent(
      this.app.workspace.on("file-menu", this.onFileMenuHandler.bind(this)),
    );

    this.app.workspace.onLayoutReady(this.onloadOnLayoutReady.bind(this));
  }

  onloadOnLayoutReady() {
    this.registerMonkeyPatches();
  }

  private async handleFileOpen(file: TFile) {
    //await openCOINote(file, this.app, this.registry);
  }

  private async handleFileRename(file: TAbstractFile, oldPath: string) {
    if (!(file instanceof TFile)) {
      console.error("File is not an instance of TFile");
      return;
    }
    await waitForMetadataCache(this.app, file);
    if (!(file instanceof TFile)) {
      console.error("File is not an instance of TFile");
      return;
    }
    if (!isCoiNote(file, this.app)) {
      return;
    }

    // Only mark as renamed if this wasn't an automatic rename
    if (!this.isPerformingAutomaticRename) {
      await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
        frontmatter["note-renamed"] = true;
      });
    } else {
      // Reset the flag after checking it
      this.isPerformingAutomaticRename = false;
    }
  }

  private onFileMenuHandler(
    menu: Menu,
    file: TFile,
    _source: string,
    _leaf: WorkspaceLeaf,
  ) {
    if (!isCoiNote(file, this.app) || isActiveCoiNote(file, this.app)) {
      return;
    }
    menu.addItem((item) => {
      item.setTitle("View as chat");
      item.onClick(() => {
        this.app.commands.executeCommandById(
          "co-intelligence:toggle-chat-view",
        );
      });
    });
  }

  async activateView() {}

  async loadSettings() {
    const data = (await this.loadData()) ?? {};
    const migrated = this.migrateLegacyApiKeys(data);
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
    if (migrated) {
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /**
   * Move API keys stored in plugin data (pre-1.1) into SecretStorage and strip
   * them from the data object so the unencrypted copy is removed on next save.
   * Returns true if any legacy key was found.
   */
  private migrateLegacyApiKeys(data: Record<string, unknown>): boolean {
    const legacyFields: Record<ApiKeyProvider, string> = {
      openai: "openaiApiKey",
      anthropic: "anthropicApiKey",
      google: "googleApiKey",
      perplexity: "perplexityApiKey",
    };
    let migrated = false;
    for (const [provider, field] of Object.entries(legacyFields) as [
      ApiKeyProvider,
      string,
    ][]) {
      if (field in data) {
        const value = data[field];
        if (typeof value === "string" && value !== "") {
          setApiKey(this.app, provider, value);
        }
        delete data[field];
        migrated = true;
      }
    }
    return migrated;
  }

  /**
   * Registers monkey patches to alter core Obsidian functionality not exposed
   * through the public API.
   *
   * Specifically, this alters setViewState to check if the opened file is a COI
   * note and if so, opens the chat view.
   *
   * @see https://github.com/zsviczian/obsidian-excalidraw-plugin/blob/master/src/core/main.ts
   */
  private registerMonkeyPatches() {
    this.register(
      around(WorkspaceLeaf.prototype, {
        setViewState(next) {
          return function (
            this: WorkspaceLeaf,
            state: ViewState,
            eState?: unknown,
          ) {
            const newState = {
              ...state,
            };
            if (state.type === "markdown") {
              const path = (state.state?.file as string) ?? "";
              if (isPathActiveCoiNote(path, this.app)) {
                newState.type = VIEW_TYPE_COI_CHAT;
              }
            }
            return next.call(this, newState, eState);
          };
        },
      }),
    );
  }
}

// Add default export for Obsidian compatibility
export default CoIntelligencePlugin;
