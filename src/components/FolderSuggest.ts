import { AbstractInputSuggest, App, TFolder } from "obsidian";

export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
  }

  getSuggestions(query: string): TFolder[] {
    const lowerQuery = query.toLowerCase();
    const folders: TFolder[] = [];
    for (const abstractFile of this.app.vault.getAllLoadedFiles()) {
      if (
        abstractFile instanceof TFolder &&
        abstractFile.path.toLowerCase().contains(lowerQuery)
      ) {
        folders.push(abstractFile);
      }
    }
    return folders;
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    (this as any).inputEl.value = folder.path;
    (this as any).inputEl.trigger("input");
    this.close();
  }
}
