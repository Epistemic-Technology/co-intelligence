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

import "./styles.css";

import {
  CoIntelligenceSettings,
  CoIntelligenceSettingsTab,
  DEFAULT_SETTINGS,
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
    this.addCommand(new ToggleChatViewCommand(this));
    this.registerView(
      VIEW_TYPE_COI_CHAT,
      (leaf: WorkspaceLeaf) => new ChatView(leaf, this, this.app),
    );

    this.addRibbonIcon("bot-message-square", "New COI Chat", () => {
      createCOINote(this.app, this);
    });
    this.registerEvent(
      this.app.workspace.on("file-open" as any, this.handleFileOpen.bind(this)),
    );
    this.registerEvent(
      this.app.vault.on("rename", this.handleFileRename.bind(this)),
    );
    this.registerEvent(
      this.app.workspace.on(
        "file-menu" as any,
        this.onFileMenuHandler.bind(this) as any,
      ),
    );

    this.app.workspace.onLayoutReady(this.onloadOnLayoutReady.bind(this));
  }

  async onloadOnLayoutReady() {
    this.registerMonkeyPatches();
  }

  private async handleFileOpen(file: TFile) {
    //await openCOINote(file, this.app, this.registry);
  }

  private async handleFileRename(file: TAbstractFile, oldPath: string) {
    if (!(await isCoiNote(file as TFile, this.app))) {
      return;
    }
    await this.app.fileManager.processFrontMatter(
      file as TFile,
      (frontmatter) => {
        frontmatter["note-renamed"] = true;
      },
    );
  }

  private async onFileMenuHandler(
    menu: Menu,
    file: TFile,
    source: string,
    leaf: WorkspaceLeaf,
  ) {
    if (!(await isCoiNote(file, this.app)) || isActiveCoiNote(file, this.app)) {
      return;
    }
    menu.addItem((item) => {
      item.setTitle("View as Chat");
      item.onClick(async () => {
        (this.app as any).commands.executeCommandById(
          "co-intelligence:toggle-chat-view",
        );
      });
    });
  }

  async activateView() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
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
  // registerMonkeyPatches() {
  //   this.register(
  //     around(WorkspaceLeaf.prototype, {
  //       setViewState(next): Function {
  //         return function (state: ViewState, ...rest: any[]) {
  //           console.log("Monkey patching setViewState");
  //           return next.apply(this, [state, ...rest]);
  //         };
  //       },
  //     }),
  //   );
  // }

  private registerMonkeyPatches() {
    const key =
      "https://github.com/zsviczian/obsidian-excalidraw-plugin/issues";
    // Monkey patch WorkspaceLeaf to open Excalidraw drawings with ExcalidrawView by default
    this.register(
      around(WorkspaceLeaf.prototype, {
        setViewState(next) {
          return function (this: any, state: ViewState, eState?: any) {
            const newState = {
              ...state,
            };
            if (state.type === "markdown") {
              const path = (state.state?.file as string) ?? "";
              if (isPathActiveCoiNote(path, this.app as App)) {
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
