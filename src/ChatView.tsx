import { ItemView, WorkspaceLeaf, App, TFile } from "obsidian";
import { render } from "solid-js/web";
import { CoreMessage } from "ai";

import { CoiChatApp } from "@/CoiChatApp";
import { CoIntelligencePlugin } from "@/CoIntelligencePlugin";
import { serializeCoiNote, deserializeCoiNote } from "@/utils/notes";

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
    return "Co-Intelligence Chat";
  }

  async handleChatChange(newMessages: CoreMessage[]): Promise<void> {
    console.log("handleChatChange");
    if (this.updating) return;
    this.updating = true;
    if (!this.file) {
      throw new Error("File is null while trying to handle chat change");
    }
    try {
      await serializeCoiNote(this.file, this.app, newMessages);
    } catch (error) {
      throw new Error(`Error serializing CoiNote: ${error}`);
    } finally {
      this.updating = false;
    }
  }

  async onOpen(): Promise<void> {
    console.log("ChatView onOpen");
    if (!this.file) {
      console.error("No file provided for chat view");
      return;
    }
    const messages = await deserializeCoiNote(this.file, this.app);
    const rootElement = this.containerEl.children[1];
    render(
      () => (
        <CoiChatApp
          app={this.app}
          plugin={this.plugin}
          file={this.file as TFile}
          onChange={this.handleChatChange}
          initialMessages={messages}
        />
      ),
      rootElement,
    );
  }
}
