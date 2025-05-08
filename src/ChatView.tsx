import { ItemView, WorkspaceLeaf, App, TFile } from "obsidian";
import { render } from "solid-js/web";
import { CoreMessage } from "ai";

import { CoiChatApp } from "@/CoiChatApp";
import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import {
  serializeCoiNote,
  deserializeCoiNote,
  renameNote,
  isActiveCoiNote,
} from "@/utils/notes";

export const VIEW_TYPE_COI_CHAT = "coi-chat-view";

export class ChatView extends ItemView {
  public plugin: CoIntelligencePlugin;
  public app: App;
  public file: TFile | null;

  private updating = false;

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
    return this.file?.path || "Co-Intelligence Chat";
  }

  async handleChatChange(
    newMessages: CoreMessage[],
    newTitle: string,
    linkedNotes?: TFile[],
  ): Promise<void> {
    if (this.updating) return;
    this.updating = true;
    if (!this.file) {
      throw new Error("File is null while trying to handle chat change");
    }
    try {
      await serializeCoiNote(this.file, this.app, newMessages, linkedNotes);
      await renameNote(this.file, this.app, newTitle);
    } catch (error) {
      throw new Error(`Error serializing CoiNote: ${error}`);
    } finally {
      this.updating = false;
    }
  }

  async onOpen(): Promise<void> {
    if (!this.file) {
      console.error("No file provided for chat view");
      this.leaf.detach();
      return;
    }
    if (!isActiveCoiNote(this.file, this.app)) {
      this.leaf.detach();
      return;
    }
    const { messages, linkedNotes } = await deserializeCoiNote(
      this.file,
      this.app,
    );
    const rootElement = this.containerEl.children[1];
    render(
      () => (
        <CoiChatApp
          app={this.app}
          plugin={this.plugin}
          file={this.file as TFile}
          onChange={(newMessages, newTitle) =>
            this.handleChatChange(newMessages, newTitle, linkedNotes)
          }
          initialMessages={messages}
          initialLinkedNotes={linkedNotes}
        />
      ),
      rootElement,
    );
  }
}
