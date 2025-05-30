import { TFile, App, requestUrl, htmlToMarkdown } from "obsidian";
import { ContextItems, ContextItemContent } from "@/types";
import { getFilesWithTag } from "./notes";

export async function getContext(
  items: ContextItems | null,
  app: App,
): Promise<ContextItemContent[]> {
  if (items === null) {
    return [];
  }
  const parsedContextItems: ContextItemContent[] = [];
  const { notes, tags, sources } = items;

  let contextNotes: TFile[] = [...notes];
  tags.forEach((tag) => {
    const tagNotes = getFilesWithTag(tag, app);
    contextNotes = [...contextNotes, ...tagNotes];
  });
  for (const note of contextNotes) {
    const content = (await app?.vault.cachedRead(note)) || "";
    parsedContextItems.push({
      title: note.name,
      content: content,
    });
  }

  for (const source of sources) {
    const sourceContent = await requestUrl({ url: source.url });
    const sourceMarkdown = htmlToMarkdown(sourceContent.text);
    parsedContextItems.push({
      title: source.title || source.url,
      content: sourceMarkdown,
    });
  }

  return parsedContextItems;
}

/**
 * Creates a context string from an array of context items.
 *
 * @param messages - The array of context items.
 * @returns The context string.
 */
export function makeContext(messages: ContextItemContent[]): string {
  if (!messages.length) {
    return "";
  }
  return messages
    .map((note) => `--- Note: ${note.title} ---\n${note.content}\n---`)
    .join("\n\n");
}

/**
 * Estimate the number of tokens from context items.
 *
 * @param items - The array of context items.
 * @returns The estimated number of tokens.
 */
export async function contextTokenEstimate(
  items: ContextItems,
  app: App,
): Promise<number> {
  const contextContent = await getContext(items, app);
  return contextContent.reduce((acc, note) => acc + note.content.length / 4, 0);
}
