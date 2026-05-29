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
 * focused in Obsidian, ignoring the COI chat note itself. Reads from
 * {@link CoIntelligencePlugin.lastUserFile}, which the plugin tracks via the
 * workspace `file-open` event; `workspace.getActiveFile()` would just point
 * back at the chat we're inside. Returns nulls when no user note has been
 * opened this session.
 */
export const getActiveNoteTool: CoiTool<Input, Output> = {
    name: "get_active_note",
    description:
        "Get the path and content of the note the user is working on (the most recent non-chat note they focused), or nulls if none is known.",
    inputSchema,
    requiresApproval: false,
    scope: "vault",
    platforms: ["desktop", "mobile"],
    async execute(_input, { app, plugin }) {
        const file = plugin.lastUserFile;
        if (!file) {
            return { path: null, content: null };
        }
        const content = await app.vault.cachedRead(file);
        return { path: file.path, content };
    },
};
