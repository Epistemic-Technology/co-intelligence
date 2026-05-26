import { TFile, normalizePath } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({
    path: z
        .string()
        .min(1, "path is required")
        .describe("Vault-relative path to the note."),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
    path: string;
    frontmatter: Record<string, unknown>;
}

/**
 * `read_frontmatter` — returns the parsed YAML frontmatter of a note as an
 * object. Empty object when none is present. Read-only; no approval.
 */
export const readFrontmatterTool: CoiTool<Input, Output> = {
    name: "read_frontmatter",
    description:
        "Read a note's YAML frontmatter as a JSON object. Returns an empty object when there is no frontmatter.",
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
        const cache = app.metadataCache.getFileCache(file);
        const frontmatter = (cache?.frontmatter ?? {}) as Record<
            string,
            unknown
        >;
        return { path: normalized, frontmatter };
    },
};
