import { TFile, App, normalizePath, TFolder, CachedMetadata } from "obsidian";
import { CoreMessage } from "ai";

import { ModelRegistry } from "@/services/model-registry";
import { VIEW_TYPE_COI_CHAT } from "@/ChatView";
import CoIntelligencePlugin from "@/CoIntelligencePlugin";
import { Source } from "@/services/model-service";

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
 * Checks if the note at path is a COI note.
 *
 * @param path - The path of the note to check.
 * @param app - The Obsidian app instance.
 * @returns True if the note is a COI note, false otherwise.
 */
export function isPathCoiNote(path: string, app: App): boolean {
  if (!path) return false;
  const cache = app.metadataCache.getCache(path);
  return cache?.frontmatter?.["is-coi-chat"] === true;
}

/**
 * Checks if the note at path is an active COI note.
 *
 * @param path - The path of the note to check.
 * @param app - The Obsidian app instance.
 * @returns True if the note is an active COI note, false otherwise.
 */
export function isPathActiveCoiNote(path: string, app: App): boolean {
  if (!path) return false;
  const cache = app.metadataCache.getCache(path);
  return (
    cache?.frontmatter?.["is-coi-chat"] === true &&
    cache?.frontmatter?.["coi-chat-view"] === true
  );
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
  "linked-notes"?: string[]; // Array of paths to linked notes
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
  if (!note || !newName) {
    return note;
  }
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
  linkedNotes?: TFile[],
  sources?: Source[],
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
      const processedContent = (content as string)
        .replace(/\[\[(.*?)\]\]/g, (match, noteName) => {
          return `[[${noteName}]]`;
        })
        // Replace Perplexity style source links with wikilinks to the Sources section.
        .replace(/\[(\d+)\]/g, (match, referenceID) => {
          return ` [[#Sources|${referenceID}]]`;
        })
        .replace(/^##/gm, "###") // Move headers one level down so that they are within the chat section
        .trim(); // Trim any leading/trailing whitespace
      return `## ${role}:\n\n${processedContent}`;
    })
    .join("\n\n");

  let serializedSources = "";
  if (sources && sources.length > 0) {
    serializedSources = "## Sources\n\n";
    sources.forEach((source, index) => {
      serializedSources += `${index + 1}. [${source.title || source.url}](${source.url})\n`;
    });
    serializedSources = serializedSources.trim();
  }

  const startIndex = currentNoteContent.indexOf(CHAT_START);
  const endIndex = currentNoteContent.lastIndexOf(CHAT_END) + CHAT_END.length;

  const beforeChat = currentNoteContent.substring(0, startIndex);
  const afterChat = currentNoteContent.substring(endIndex);

  // Maintain consistent formatting with exactly one newline after CHAT_START and 
  // one newline before CHAT_END, and exactly one blank line between sections
  const newChatSection = sources && sources.length > 0
    ? `${CHAT_START}\n${serializedMessages}\n\n${serializedSources}\n${CHAT_END}`
    : `${CHAT_START}\n${serializedMessages}\n${CHAT_END}`;
  const newNoteContent = beforeChat + newChatSection + afterChat;

  if (newNoteContent !== currentNoteContent) {
    await app.vault.modify(note, newNoteContent);
  }

  if (linkedNotes && linkedNotes.length > 0) {
    await app.fileManager.processFrontMatter(note, (frontmatter) => {
      frontmatter["linked-notes"] = linkedNotes.map((file) => file.path);
    });
  }
}

export async function deserializeCoiNote(note: TFile, app: App) {
  const metadata = app.metadataCache.getFileCache(note);
  return deserializeCoiNoteContent(
    await app.vault.cachedRead(note),
    metadata,
    app,
  );
}

export async function deserializeCoiNoteContent(
  content: string,
  metadata: CachedMetadata | null,
  app: App,
): Promise<{
  messages: CoreMessage[];
  linkedNotes: TFile[];
  sources: Source[];
}> {
  if (!pattern.test(content)) {
    return { messages: [], linkedNotes: [], sources: [] };
  }
  const serializedContent = content.match(pattern);
  if (!serializedContent) {
    return { messages: [], linkedNotes: [], sources: [] };
  }

  const messages: CoreMessage[] = [];
  const sources: Source[] = [];
  const lines = serializedContent[0].split("\n");

  let currentMode: "user" | "assistant" | "sources" | "" = "";
  let contentBuffer: string[] = [];

  const flushContent = () => {
    if (currentMode == "user" || currentMode == "assistant") {
      messages.push({
        role: currentMode,
        // Remove any excess leading/trailing whitespace from joined content
        content: contentBuffer.join("\n").trim(),
      });
    } else if (currentMode == "sources") {
      const sourceRegex = /\d+\. \[(.*?)\]\((.*?)\)/;
      for (const line of contentBuffer) {
        const match = line.match(sourceRegex);
        if (match) {
          sources.push({
            title: match[1],
            url: match[2],
          });
        }
      }
    }
  };

  for (const line of lines) {
    if (line.startsWith("## ")) {
      flushContent();
      const candidateMode = line
        .replace(/^## /, "")
        .replace(/\:/, "")
        .trim()
        .toLowerCase();
      if (
        candidateMode !== "user" &&
        candidateMode !== "assistant" &&
        candidateMode !== "sources"
      ) {
        console.error(`Invalid mode: ${candidateMode}`);
        continue;
      }
      currentMode = candidateMode;
      contentBuffer = [];
    } else if (!line.contains(CHAT_END) && !line.contains(CHAT_START)) {
      contentBuffer.push(line);
    }
  }
  flushContent();

  const linkedNotes: TFile[] = [];
  const linkedNotePaths = metadata?.frontmatter?.["linked-notes"] || [];

  for (const path of linkedNotePaths) {
    const file = app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      linkedNotes.push(file);
    }
  }

  const wikiLinkRegex = /\[\[(.*?)\]\]/g;
  for (const message of messages) {
    let match;
    while ((match = wikiLinkRegex.exec(message.content as string)) !== null) {
      const linkText = match[1];
      // Handle any aliases in the link (e.g., [[Note|Alias]])
      const noteName = linkText.split("|")[0];

      const files = app.vault.getMarkdownFiles();
      const linkedFile = files.find((file) => file.basename === noteName);

      if (
        linkedFile &&
        !linkedNotes.some((note) => note.path === linkedFile.path)
      ) {
        linkedNotes.push(linkedFile);
      }
    }
  }

  return { messages, linkedNotes, sources };
}
