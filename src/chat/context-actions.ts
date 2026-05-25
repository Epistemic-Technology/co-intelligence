import { TFile } from "obsidian";
import type { ContextItems, Tag } from "@/types";

/**
 * Returns a new {@link ContextItems} with `file` appended to `notes`, or the
 * input unchanged if the file is already linked. Pass `null` to seed an empty
 * context with just this note.
 */
export function addNoteToContext(
    items: ContextItems | null,
    file: TFile,
): ContextItems {
    if (items === null) {
        return { notes: [file], tags: [], sources: [] };
    }
    if (items.notes.some((note) => note.path === file.path)) {
        return items;
    }
    return {
        notes: [...items.notes, file],
        tags: items.tags,
        sources: items.sources,
    };
}

/**
 * Returns a new {@link ContextItems} with `tag` appended to `tags`, or the
 * input unchanged if the tag is already linked. Pass `null` to seed an empty
 * context with just this tag.
 */
export function addTagToContext(
    items: ContextItems | null,
    tag: Tag,
): ContextItems {
    if (items === null) {
        return { notes: [], tags: [tag], sources: [] };
    }
    if (items.tags.includes(tag)) {
        return items;
    }
    return {
        notes: items.notes,
        tags: [...items.tags, tag],
        sources: items.sources,
    };
}
