import {
  TFile,
  App,
  normalizePath,
  TFolder,
  CachedMetadata,
  MetadataCache,
  getAllTags,
} from "obsidian";
import { ModelChatMessage } from "@/types";

import { ModelRegistry } from "@/services/model-registry";
import { VIEW_TYPE_COI_CHAT } from "@/ChatView";
import type CoIntelligencePlugin from "@/CoIntelligencePlugin";
import {
  Source,
  CoiNoteFrontmatter,
  ContextItems,
  ContextItemContent,
  ChatRequest,
  Model,
} from "@/types";

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
  await new Promise((resolve) => window.setTimeout(resolve, 100));
  const leaf = app.workspace.getLeaf();
  await leaf.openFile(file);
}

export async function renameNote(
  note: TFile,
  newName: string,
  app: App,
  plugin?: CoIntelligencePlugin,
): Promise<TFile> {
  if (!note || !newName) {
    return note;
  }
  const metadata = await waitForMetadataCache(app, note);
  if (metadata?.frontmatter?.["note-renamed"]) {
    return note;
  }

  if (newName.length === 0) {
    return note;
  }

  if (newName.length > 200) {
    newName = newName.slice(0, 200);
  }

  if (newName === note.basename) {
    return note;
  }

  try {
    // Set flag before automatic rename
    if (plugin) {
      plugin.isPerformingAutomaticRename = true;
    }

    const parentPath = note.parent ? note.parent.path : "";
    const newPath = normalizePath(
      `${parentPath}/${newName}${note.extension ? "." + note.extension : ""}`,
    );
    await app.fileManager.renameFile(note, newPath);
    const newFile = app.vault.getAbstractFileByPath(newPath);
    if (!(newFile instanceof TFile)) {
      console.warn("Failed to rename note:", newFile);
      return note;
    }
    return newFile;
  } catch (error) {
    console.error("Error renaming note:", error);
    // Reset flag on error since the rename event won't fire
    if (plugin) {
      plugin.isPerformingAutomaticRename = false;
    }
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

export async function serializeCoiNoteContent(
  currentNoteContent: string,
  app: App,
  messages: ModelChatMessage[],
  contextItems: ContextItems | null,
  sources?: Source[],
): Promise<string> {
  const serializedMessages = messages
    .map(({ role, content }) => {
      const contentStr = content as string;

      // Find the highest level header in the content
      const headerMatches = contentStr.match(/^#+/gm);
      let minHeaderLevel = Infinity;
      if (headerMatches) {
        for (const match of headerMatches) {
          minHeaderLevel = Math.min(minHeaderLevel, match.length);
        }
      }

      let processedContent = contentStr.replace(
        /\[\[(.*?)\]\]/g,
        (match, noteName) => {
          return `[[${noteName}]]`;
        },
      );

      // Adjust headers based on the highest level found
      if (minHeaderLevel === 1) {
        processedContent = processedContent.replace(
          /^(#+)/gm,
          (match) => match + "##",
        );
      } else if (minHeaderLevel === 2) {
        processedContent = processedContent.replace(
          /^(#+)/gm,
          (match) => match + "#",
        );
      }

      processedContent = processedContent.trim(); // Trim any leading/trailing whitespace
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
  const newChatSection =
    sources && sources.length > 0
      ? `${CHAT_START}\n${serializedMessages}\n\n${serializedSources}\n${CHAT_END}`
      : `${CHAT_START}\n${serializedMessages}\n${CHAT_END}`;
  const newNoteContent = beforeChat + newChatSection + afterChat;
  return newNoteContent;
}

export async function serializeCoiNote(
  note: TFile,
  app: App,
  messages: ModelChatMessage[],
  contextItems: ContextItems | null,
  lastModelId: string | null,
  sources?: Source[],
) {
  const currentNoteContent = await app.vault.read(note);

  if (
    !currentNoteContent.includes(CHAT_START) ||
    !currentNoteContent.includes(CHAT_END)
  ) {
    return;
  }

  const newNoteContent = await serializeCoiNoteContent(
    currentNoteContent,
    app,
    messages,
    contextItems,
    sources,
  );
  if (newNoteContent !== currentNoteContent) {
    await app.vault.modify(note, newNoteContent);
  }

  if (contextItems) {
    await app.fileManager.processFrontMatter(note, (frontmatter) => {
      frontmatter["linked-notes"] = contextItems.notes.map((file) => file.path);
      frontmatter["linked-tags"] = contextItems.tags;
    });
  }
  if (lastModelId && lastModelId.contains(":")) {
    await app.fileManager.processFrontMatter(note, (frontmatter) => {
      const tag = sanitizeForTagName(lastModelId);
      if (!frontmatter.tags) {
        frontmatter.tags = ["coi-chat", tag];
      } else if (!frontmatter.tags.includes(tag)) {
        frontmatter.tags.push(tag);
      }
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
  messages: ModelChatMessage[];
  contextItems: ContextItems;
  sources: Source[];
}> {
  if (!pattern.test(content)) {
    return {
      messages: [],
      contextItems: { notes: [], tags: [], sources: [] },
      sources: [],
    };
  }
  const serializedContent = content.match(pattern);
  if (!serializedContent) {
    return {
      messages: [],
      contextItems: { notes: [], tags: [], sources: [] },
      sources: [],
    };
  }

  const messages: ModelChatMessage[] = [];
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

  const contextItems: ContextItems = {
    notes: [],
    tags: [],
    sources: [],
  };

  const linkedNotePaths = metadata?.frontmatter?.["linked-notes"] || [];
  for (const path of linkedNotePaths) {
    const file = app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      contextItems.notes.push(file);
    }
  }

  const linkedTags = metadata?.frontmatter?.["linked-tags"] || [];
  for (const tag of linkedTags) {
    contextItems.tags.push(tag);
  }

  return { messages, contextItems, sources };
}

export const getFilesWithTag = (tag: string, app: App): TFile[] => {
  const filesWithTag: TFile[] = [];

  const allFiles = app.vault.getMarkdownFiles();
  for (const file of allFiles) {
    const cache = app.metadataCache.getCache(file.path);
    if (!cache) continue;
    const tags = getAllTags(cache);

    if (tags?.includes(tag)) {
      filesWithTag.push(file);
    }
  }

  return filesWithTag;
};

/**
 * Waits for the metadata cache to be available for a file.
 */
export async function waitForMetadataCache(
  app: App,
  file: TFile,
  retries = 10,
  delayMs = 200,
): Promise<ReturnType<MetadataCache["getFileCache"]> | null> {
  for (let i = 0; i < retries; i++) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache) return cache;
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }
  return null;
}

/**
 * Sanitize strings for tag names
 */
export function sanitizeForTagName(str: string): string {
  let s = str.trim();
  s = s.replace(/[^a-zA-Z0-9/_-]+/g, "-");
  s = s.replace(/-+/g, "-");
  s = s.replace(/^[-/]+|[-/]+$/g, "");
  s = s.toLowerCase();
  return s;
}
