import { z } from "zod";

import type { CoiTool } from "@/agent/types";

const inputSchema = z.object({});

type Input = z.infer<typeof inputSchema>;

interface Output {
    path: string | null;
    content: string | null;
}

/**
 * `get_active_note` — returns the path and content of the note the user has
 * focused in Obsidian. Returns nulls when no note is active (e.g. a non-file
 * pane is focused). Read-only; no approval.
 */
export const getActiveNoteTool: CoiTool<Input, Output> = {
    name: "get_active_note",
    description:
        "Get the path and content of the note the user is currently viewing in Obsidian, or nulls if no note is active.",
    inputSchema,
    requiresApproval: false,
    scope: "vault",
    platforms: ["desktop", "mobile"],
    async execute(_input, { app }) {
        const file = app.workspace.getActiveFile();
        if (!file) {
            return { path: null, content: null };
        }
        const content = await app.vault.cachedRead(file);
        return { path: file.path, content };
    },
};
