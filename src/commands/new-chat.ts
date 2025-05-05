import { App, Plugin, Command, TFile, TFolder, normalizePath } from "obsidian";

import CoIntelligencePlugin from "@/CoIntelligencePlugin";
import { createCOINote } from "@/utils/notes";

export class NewChatCommand implements Command {
  private app: App;
  private plugin: CoIntelligencePlugin;

  id: string = "new-chat";
  name: string = "New Chat";

  constructor(plugin: CoIntelligencePlugin) {
    this.plugin = plugin;
    this.app = this.plugin.app;
  }

  callback = async () => {
    await createCOINote(this.app, this.plugin);
  };
}
