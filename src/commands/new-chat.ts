import { App, Plugin, Command, TFile, TFolder, normalizePath } from "obsidian";

import CoIntelligencePlugin from "@/main";

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
    console.log("Creating a new chat...");
    const folderPath = normalizePath(this.plugin.settings.defaultFolder);
    let folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) {
      folder = await this.app.vault.createFolder(folderPath);
    }
    const dateString = new Date().toISOString().split("T")[0];
    const timeString = new Date()
      .toTimeString()
      .split(" ")[0]
      .replace(/:/g, "-");
    const newChatName = `chat_${dateString}_${timeString}`;
    const file = await this.app.vault.create(
      `${folder.path}/${newChatName}.md`,
      "",
    );
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter["is-coi-chat"] = true;
      frontmatter.tags = ["coi-chat"];
    });
    const leaf = this.app.workspace.getLeaf();
    await leaf.openFile(file);
  };
}
