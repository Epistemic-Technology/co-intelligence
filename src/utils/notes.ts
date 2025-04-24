import { TFile, App } from "obsidian";

export function isCOINote(note: TFile, app: App): boolean {
  const metadata = app.metadataCache.getFileCache(note);
  return metadata?.frontmatter?.["is-coi-chat"] === true;
}

export async function logNoteContent(note: TFile, app: App): Promise<void> {
  try {
    const content = await app.vault.read(note);
    console.log(`Content of note '${note.name}':`);
    console.log("----------------------------------------");
    console.log(content);
    console.log("----------------------------------------");
  } catch (error) {
    console.error(`Error reading note '${note.name}':`, error);
  }
}
