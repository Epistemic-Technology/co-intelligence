import { App, TFile } from "obsidian";
import type { CoiNoteFrontmatter } from "@/types";

const SESSION_ID_KEY = "coi-session-id";

/**
 * Returns the `coi-session-id` recorded in a note's frontmatter, or `undefined`
 * if absent. Cache-only read — does not touch the file.
 */
export function getSessionId(note: TFile, app: App): string | undefined {
    const cache = app.metadataCache.getFileCache(note);
    const fm = cache?.frontmatter as CoiNoteFrontmatter | undefined;
    return fm?.[SESSION_ID_KEY];
}

/**
 * Writes the `coi-session-id` into a note's frontmatter. Idempotent — if the
 * key is already set to `sessionId`, this is a no-op.
 */
export async function setSessionId(
    note: TFile,
    sessionId: string,
    app: App,
): Promise<void> {
    if (getSessionId(note, app) === sessionId) return;
    await app.fileManager.processFrontMatter(note, (frontmatter) => {
        (frontmatter as CoiNoteFrontmatter)[SESSION_ID_KEY] = sessionId;
    });
}

/**
 * Finds the first chat note in the vault whose frontmatter `coi-session-id`
 * matches. Returns `null` when no match exists. O(n) over markdown files —
 * fine for the rare "session orphaned from note" recovery path.
 */
export function findNoteBySessionId(
    sessionId: string,
    app: App,
): TFile | null {
    for (const file of app.vault.getMarkdownFiles()) {
        const cache = app.metadataCache.getFileCache(file);
        const fm = cache?.frontmatter as CoiNoteFrontmatter | undefined;
        if (fm?.[SESSION_ID_KEY] === sessionId) return file;
    }
    return null;
}
