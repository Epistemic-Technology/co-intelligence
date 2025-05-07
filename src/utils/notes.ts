import { TFile, App, normalizePath, TFolder } from "obsidian";
import { CoreMessage } from "ai";

import { ModelRegistry } from "@/services/model-registry";
import { VIEW_TYPE_COI_CHAT } from "@/ChatView";
import CoIntelligencePlugin from "@/CoIntelligencePlugin";

const CHAT_START = "<!-- CHAT-THREAD-START -->";
const CHAT_END = "<!-- CHAT-THREAD-END -->";
const pattern = new RegExp(`${CHAT_START}[\\s\\S]*?${CHAT_END}`, "m");

/**
 * Checks if a note is a COI note.
 *
 * @param note - The note to check.
 * @param app - The Obsidian app instance.
 * @returns True if the note is a COI note, false otherwise.
 */
export function isCoiNote(note: TFile, app: App): boolean {
  const metadata = app.metadataCache.getFileCache(note);
  return metadata?.frontmatter?.["is-coi-chat"] === true;
}

/**
 * Checks if a note is active COI note. A note is active if it is a COI note and
 * the active view is chat view.
 *
 * @param note - The note to check.
 * @param app - The Obsidian app instance.
 * @returns True if the note is active COI note, false otherwise.
 */
export function isActiveCoiNote(note: TFile, app: App): boolean {
  const metadata = app.metadataCache.getFileCache(note);
  return (
    metadata?.frontmatter?.["is-coi-chat"] === true &&
    metadata?.frontmatter?.["coi-chat-view"] === true
  );
}

export interface CoiNoteFrontmatter {
  "is-coi-chat": boolean;
  "coi-chat-view": boolean;
  "note-renamed": boolean;
  tags: string[];
}

export async function createCOINote(app: App, plugin: CoIntelligencePlugin) {
  const folderPath = normalizePath(plugin.settings.defaultFolder);
  let folder = app.vault.getAbstractFileByPath(folderPath);
  if (!(folder instanceof TFolder)) {
    folder = await app.vault.createFolder(folderPath);
  }
  const dateString = new Date().toISOString().split("T")[0];
  const timeString = new Date().toTimeString().split(" ")[0].replace(/:/g, "-");
  const newChatName = `chat_${dateString}_${timeString}`;
  const file = await app.vault.create(`${folder.path}/${newChatName}.md`, "");
  await app.vault.modify(file, `${CHAT_START}\n\n${CHAT_END}`);
  const newFrontmatter: CoiNoteFrontmatter = {
    "is-coi-chat": true,
    "coi-chat-view": true,
    "note-renamed": false,
    tags: ["coi-chat"],
  };
  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    Object.assign(frontmatter, newFrontmatter);
  });
  // Add a small delay to allow the frontmatter to be saved before opening the note.
  await new Promise((resolve) => setTimeout(resolve, 100));
  const leaf = app.workspace.getLeaf();
  await leaf.openFile(file);
}

export async function renameNote(
  note: TFile,
  app: App,
  newName: string,
): Promise<TFile> {
  const metadata = app.metadataCache.getFileCache(note);
  if (metadata?.frontmatter?.["note-renamed"]) {
    return note;
  }

  try {
    const parentPath = note.parent ? note.parent.path : "";
    const newPath = normalizePath(
      `${parentPath}/${newName}${note.extension ? "." + note.extension : ""}`,
    );
    await app.fileManager.renameFile(note, newPath);
    return app.vault.getAbstractFileByPath(newPath) as TFile;
  } catch (error) {
    console.error("Error renaming note:", error);
    return note;
  }
}

export async function openCOINote(
  file: TFile,
  app: App,
  registry: ModelRegistry,
) {
  if (!isCoiNote(file, app)) {
    return;
  }

  registry.reinitialize();
  const leaf = app.workspace.getLeaf(true);
  await leaf.openFile(file, { active: true });
  await leaf.setViewState({
    type: VIEW_TYPE_COI_CHAT,
    state: { file: file.path },
    active: true,
  });
}

export async function serializeCoiNote(
  note: TFile,
  app: App,
  messages: CoreMessage[],
) {
  const currentNoteContent = await app.vault.cachedRead(note);

  if (
    !currentNoteContent.includes(CHAT_START) ||
    !currentNoteContent.includes(CHAT_END)
  ) {
    return;
  }

  const serializedMessages = messages
    .map(({ role, content }) => {
      return `## ${role}:\n\n${content}`;
    })
    .join("\n\n");

  const startIndex = currentNoteContent.indexOf(CHAT_START);
  const endIndex = currentNoteContent.lastIndexOf(CHAT_END) + CHAT_END.length;

  const beforeChat = currentNoteContent.substring(0, startIndex);
  const afterChat = currentNoteContent.substring(endIndex);

  const newChatSection = `${CHAT_START}\n${serializedMessages}\n${CHAT_END}`;
  const newNoteContent = beforeChat + newChatSection + afterChat;

  if (newNoteContent !== currentNoteContent) {
    await app.vault.modify(note, newNoteContent);
  }
}

export async function deserializeCoiNote(
  note: TFile,
  app: App,
): Promise<CoreMessage[]> {
  const currentNoteContent = await app.vault.cachedRead(note);
  if (!pattern.test(currentNoteContent)) {
    return [];
  }
  const serializedMessages = currentNoteContent.match(pattern);
  if (!serializedMessages) {
    return [];
  }

  const messages: CoreMessage[] = [];
  const lines = serializedMessages[0].split("\n");

  let currentRole: "user" | "assistant" | "" = "";
  let contentBuffer: string[] = [];

  const flushContent = () => {
    if (currentRole) {
      messages.push({
        role: currentRole,
        content: contentBuffer.join("\n"),
      });
    }
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flushContent();
      const candidateRole = line.replace(/^## /, "").replace(/\:/, "").trim();
      if (candidateRole !== "user" && candidateRole !== "assistant") {
        console.error(`Invalid role: ${candidateRole}`);
        break;
      }
      currentRole = candidateRole;
      contentBuffer = [];
    } else if (!line.contains(CHAT_END) && !line.contains(CHAT_START)) {
      contentBuffer.push(line);
    }
  }
  flushContent();
  return messages;
}
