import { TFile, normalizePath } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({
    path: z
        .string()
        .min(1, "path is required")
        .describe("Vault-relative path to the note."),
    updates: z
        .record(z.string(), z.unknown())
        .describe(
            "Object of keys to set. Existing keys are overwritten; pass null to remove a key.",
        ),
});

type Input = z.infer<typeof inputSchema>;

interface Output {
    path: string;
    keysWritten: string[];
    keysRemoved: string[];
}

/**
 * `set_frontmatter` — merges updates into a note's YAML frontmatter. `null`
 * values delete keys, other values overwrite. Requires approval (writes to
 * vault state).
 */
export const setFrontmatterTool: CoiTool<Input, Output> = {
    name: "set_frontmatter",
    description:
        "Merge key/value updates into a note's YAML frontmatter. Existing keys are overwritten. Pass null as a value to delete that key.",
    inputSchema,
    requiresApproval: true,
    scope: "vault",
    platforms: ["desktop", "mobile"],
    async execute({ path, updates }, { app }) {
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
        const keysWritten: string[] = [];
        const keysRemoved: string[] = [];
        await app.fileManager.processFrontMatter(file, (frontmatter) => {
            for (const [key, value] of Object.entries(updates)) {
                if (value === null) {
                    delete frontmatter[key];
                    keysRemoved.push(key);
                } else {
                    frontmatter[key] = value;
                    keysWritten.push(key);
                }
            }
        });
        return { path: normalized, keysWritten, keysRemoved };
    },
};
