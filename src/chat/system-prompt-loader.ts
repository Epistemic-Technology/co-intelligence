import { App, TFile } from "obsidian";

/**
 * Loads a system prompt from a vault note. Returns `undefined` when the path is
 * empty or the file is missing. Read errors propagate so callers can surface them
 * however they want (Notice, log, etc.).
 */
export async function loadSystemPrompt(
    path: string | undefined,
    app: App,
): Promise<string | undefined> {
    if (!path || path.trim() === "") {
        return undefined;
    }
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
        return undefined;
    }
    return await app.vault.read(file);
}
