import { TFile, normalizePath } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({
    path: z
        .string()
        .min(1, "path is required")
        .describe(
            "Vault-relative path to the note, including the `.md` extension (e.g. `Daily/2025-05-25.md`).",
        ),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
    path: string;
    content: string;
}

/**
 * `read_note` — returns the full markdown content of a vault note at the given
 * path. Read-only; never requires approval. Mobile-safe (Obsidian Vault API).
 *
 * Errors thrown here surface as `tool-error` events; the controller writes
 * them into the session as `tool-result` parts with `isError: true`.
 */
export const readNoteTool: CoiTool<Input, Output> = {
    name: "read_note",
    description:
        "Read the full markdown content of a note in the vault. Returns the raw text including frontmatter.",
    inputSchema,
    requiresApproval: false,
    scope: "vault",
    platforms: ["desktop", "mobile"],
    async execute({ path }, { app }) {
        const normalized = normalizePath(path);
        const file = app.vault.getAbstractFileByPath(normalized);
        if (!file) {
            throw new Error(`Note not found at "${normalized}"`);
        }
        if (!(file instanceof TFile)) {
            throw new Error(
                `Path "${normalized}" refers to a folder, not a note`,
            );
        }
        const content = await app.vault.cachedRead(file);
        return { path: normalized, content };
    },
};
