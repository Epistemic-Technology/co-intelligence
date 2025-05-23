import {
  ItemView,
  WorkspaceLeaf,
  App,
  TFile,
  TextFileView,
  Menu,
} from "obsidian";
import { render } from "solid-js/web";
import { CoreMessage } from "ai";

import { CoiChatApp } from "@/CoiChatApp";
import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import {
  serializeCoiNote,
  deserializeCoiNote,
  renameNote,
  isActiveCoiNote,
  deserializeCoiNoteContent,
  serializeCoiNoteContent,
} from "@/utils/notes";
import { Source, ContextItems } from "@/types";

export const VIEW_TYPE_COI_CHAT = "coi-chat-view";

export interface HandleChatChangeProps {
  newMessages: CoreMessage[];
  newTitle: string;
  contextItems: ContextItems | null;
  sources?: Source[];
}

export class ChatView extends TextFileView {
  public plugin: CoIntelligencePlugin;
  public app: App;
  public file: TFile | null;
  public messages: CoreMessage[] = [];
  public contextItems: ContextItems = { notes: [], tags: [], sources: [] };
  public sources: Source[] = [];
  public rootElement: Element | null = null;
  public dispose: any;

  private updating = false;
  private debounceTimeout: number | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: CoIntelligencePlugin, app: App) {
    super(leaf);
    this.plugin = plugin;
    this.app = app;
    this.file = app.workspace.getActiveFile();
    this.handleChatChange = this.handleChatChange.bind(this);
  }

  getViewType(): string {
    return VIEW_TYPE_COI_CHAT;
  }

  getDisplayText(): string {
    return this.file?.basename || "Co-Intelligence Chat";
  }

  async debounceUpdateViewData() {
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }
    this.debounceTimeout = setTimeout(() => {
      this.debounceTimeout = null;
      this.updateViewData();
    }, 500);
  }

  async updateViewData() {
    if (this.updating) {
      return;
    }
    if (!this.file) {
      return "";
    }
    this.updating = true;
    const currentNoteContent = await this.app.vault.cachedRead(this.file);
    const content = await serializeCoiNoteContent(
      currentNoteContent,
      this.app,
      this.messages,
      this.contextItems,
    );
    this.data = content;
    this.requestSave();
    this.updating = false;
  }

  getViewData() {
    return this.data;
  }

  async setViewData(data: string, clear: boolean) {
    this.data = data;
    if (!this.file) {
      console.error("File is null while trying to set view data");
      return;
    }
    if (clear) {
      this.clear();
    }
    const metadata = this.app.metadataCache.getFileCache(this.file);
    const { messages, contextItems, sources } = await deserializeCoiNoteContent(
      data,
      metadata,
      this.app,
    );
    this.messages = messages;
    this.contextItems = contextItems;
    this.sources = sources;
  }

  clear(): void {
    this.messages = [];
    this.contextItems = {
      notes: [],
      tags: [],
      sources: [],
    };
    this.sources = [];
    if (this.dispose) {
      this.dispose();
    }
  }

  async render() {
    this.rootElement = this.rootElement || this.containerEl.children[1];
    if (!this.rootElement) {
      console.error("Root element is null");
      return;
    }
    this.dispose = render(
      () => (
        <CoiChatApp
          app={this.app}
          plugin={this.plugin}
          file={this.file as TFile}
          onChange={this.handleChatChange}
          initialMessages={this.messages}
          initialContext={this.contextItems}
          initialSources={this.sources}
        />
      ),
      this.rootElement,
    );
  }

  async handleChatChange({
    newMessages,
    newTitle,
    contextItems,
    sources,
  }: HandleChatChangeProps): Promise<void> {
    if (this.updating) return;
    this.updating = true;
    if (!this.file) {
      console.error("File is null while trying to handle chat change");
    }
    if (!this.file) {
      console.error("File is null while trying to handle chat change");
      return;
    }
    try {
      await serializeCoiNote(
        this.file,
        this.app,
        newMessages,
        contextItems,
        sources,
      );
      await renameNote(this.file, this.app, newTitle);
    } catch (error) {
      console.error(`Error serializing CoiNote: ${error}`);
    } finally {
      this.updating = false;
    }
  }

  async onLoadFile(file: TFile): Promise<void> {
    this.file = file;
    const { messages, contextItems, sources } = await deserializeCoiNote(
      file,
      this.app,
    );
    this.messages = messages;
    this.contextItems = contextItems;
    this.sources = sources;
    await this.render();
  }

  async onUnloadFile(file: TFile): Promise<void> {
    this.clear();
  }

  async onOpen(): Promise<void> {
    if (!this.file) {
      console.error("No file provided for chat view");
      return;
    }
    if (!isActiveCoiNote(this.file, this.app)) {
      return;
    }
    const { messages, contextItems, sources } = await deserializeCoiNote(
      this.file,
      this.app,
    );
    this.messages = messages;
    this.contextItems = contextItems;
    this.sources = sources;
    await this.render();
  }

  onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | string): void {
    menu.addItem((item) => {
      item
        .setTitle("View as Markdown")
        .setIcon("bot-message-square")
        .onClick(() => {
          (this.app as any).commands.executeCommandById(
            "co-intelligence:toggle-chat-view",
          );
        });
    });
    super.onPaneMenu(menu, source);
  }
}
