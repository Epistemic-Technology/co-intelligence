import { TFile, TFolder, normalizePath } from "obsidian";
import { z } from "zod";

import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({
    path: z
        .string()
        .default("")
        .describe(
            "Vault-relative folder path. Empty string or '/' for the vault root.",
        ),
});

type Input = z.infer<typeof inputSchema>;

interface ListEntry {
    name: string;
    path: string;
    kind: "file" | "folder";
}

interface Output {
    path: string;
    entries: ListEntry[];
}

/**
 * `list_folder` — lists the immediate children of a vault folder. Returns
 * names + paths, partitioned into files vs folders by `kind`. Non-recursive;
 * agents call again for deeper traversal. Read-only; no approval.
 */
export const listFolderTool: CoiTool<Input, Output> = {
    name: "list_folder",
    description:
        "List the immediate files and subfolders inside a vault folder. Pass an empty path for the vault root.",
    inputSchema,
    requiresApproval: false,
    scope: "vault",
    platforms: ["desktop", "mobile"],
    async execute({ path }, { app }) {
        const normalized = path === "" || path === "/" ? "" : normalizePath(path);
        const folder =
            normalized === ""
                ? app.vault.getRoot()
                : app.vault.getAbstractFileByPath(normalized);
        if (!folder) {
            throw new Error(`Folder not found at "${normalized}"`);
        }
        if (!(folder instanceof TFolder)) {
            throw new Error(
                `Path "${normalized}" refers to a file, not a folder`,
            );
        }
        const entries: ListEntry[] = folder.children.map((child) => ({
            name: child.name,
            path: child.path,
            kind: child instanceof TFile ? "file" : "folder",
        }));
        entries.sort((a, b) => {
            if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
            return a.name.localeCompare(b.name);
        });
        return { path: normalized || "/", entries };
    },
};
